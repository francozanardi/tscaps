import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { RenderTimeMap } from '@tscaps/engine';
import { AudioGraph } from '@presentation/editor/controllers/AudioGraph';

const FRAME_S = 1 / 30;
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export class VideoController {
  private rafId: number = 0;
  private lastPropagatedTime: number = -1;
  private audioGraph: AudioGraph | null = null;
  private cachedCutsRef: CutRegistry | null = null;
  private cachedTimeMap = new RenderTimeMap([]);

  constructor(
    private readonly el: HTMLVideoElement,
    private readonly store: EditorStore,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder,
  ) {}

  start(): void {
    // Push persisted playback preferences onto the freshly-mounted element
    // before listeners attach. A new `<video>` ignores prior session state
    // and would otherwise play at default volume / rate, leaving the UI
    // (which reads the store) out of sync with what the user actually hears.
    const { volume, playbackRate, currentTime } = this.store.snapshot().video;
    this.el.volume = volume;
    this.el.playbackRate = playbackRate;

    this.el.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.el.addEventListener('loadeddata', this.onLoadedData);
    this.el.addEventListener('emptied', this.onEmptied);
    this.el.addEventListener('error', this.onError);
    this.el.addEventListener('resize', this.updateLayout);
    this.el.addEventListener('play', this.onPlayStateChange);
    this.el.addEventListener('pause', this.onPlayStateChange);
    this.el.addEventListener('volumechange', this.onVolumeChange);
    this.audioGraph = new AudioGraph(this.el);
    this.rafId = requestAnimationFrame(this.tick);

    this.seekIfPossible(currentTime);

    this.updateLayout();
    // The controller may attach after `loadeddata` already fired (e.g.
    // hot-reload, fast hydration from a cached video). readyState ≥ 2
    // means at least the current frame is decoded, which is the same
    // signal `loadeddata` would carry.
    if (this.el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.store.setIsVideoReady(true);
    }
  }

  stop(): void {
    this.el.removeEventListener('loadedmetadata', this.onLoadedMetadata);
    this.el.removeEventListener('loadeddata', this.onLoadedData);
    this.el.removeEventListener('emptied', this.onEmptied);
    this.el.removeEventListener('error', this.onError);
    this.el.removeEventListener('resize', this.updateLayout);
    this.el.removeEventListener('play', this.onPlayStateChange);
    this.el.removeEventListener('pause', this.onPlayStateChange);
    this.el.removeEventListener('volumechange', this.onVolumeChange);
    cancelAnimationFrame(this.rafId);
    const graph = this.audioGraph;
    if (graph) {
      this.audioGraph = null;
      void graph.dispose();
    }
  }

  prevFrame(): void {
    this.stepByOutputDelta(-FRAME_S);
  }

  nextFrame(): void {
    this.stepByOutputDelta(FRAME_S);
  }

  prevWord(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.store.snapshot().video.currentTime;
    const words = doc.getWords();
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i]!.time.isBefore(currentTime)) { this.seek(words[i]!.time.midpoint); return; }
    }
  }

  nextWord(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.store.snapshot().video.currentTime;
    const next = doc.getWords().find(w => w.time.isAfter(currentTime));
    if (next) this.seek(next.time.midpoint);
  }

  prevSegment(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.store.snapshot().video.currentTime;
    const segs = doc.getSegments();
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i]!.time.isBefore(currentTime)) { this.seek(segs[i]!.time.midpoint); return; }
    }
  }

  nextSegment(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.store.snapshot().video.currentTime;
    const next = doc.getSegments().find(s => s.time.isAfter(currentTime));
    if (next) this.seek(next.time.midpoint);
  }

  private visibleDocument() {
    const { document, cuts } = this.store.snapshot();
    if (!document) return null;
    return this.cutAwareDocumentBuilder.build(document, cuts);
  }

  setPlaybackRate(rate: number): void {
    this.el.playbackRate = rate;
    this.store.setPlaybackRate(rate);
  }

  changePlaybackRate(delta: number): void {
    const current = this.el.playbackRate;
    const idx = SPEEDS.findIndex(s => Math.abs(s - current) < 0.01);
    const base = idx === -1 ? SPEEDS.indexOf(1) : idx;
    const next = Math.max(0, Math.min(SPEEDS.length - 1, base + delta));
    this.setPlaybackRate(SPEEDS[next]!);
  }

  togglePlay(): void {
    if (this.el.paused) {
      void this.audioGraph?.resume();
      this.el.play().catch(() => {});
    } else {
      this.el.pause();
    }
  }

  pause(): void {
    this.el.pause();
  }

  /**
   * Schedule the video's audio output to drop to silence after
   * `wallClockSec` real-time seconds from now, applied by the
   * audio rendering thread with sample accuracy. The caller is
   * responsible for converting selection media-time deltas into
   * wall-clock seconds (i.e., divide by `playbackRate`).
   */
  scheduleAudioMuteIn(wallClockSec: number): void {
    this.audioGraph?.scheduleMuteIn(wallClockSec);
  }

  /** Cancel any pending scheduled audio mute and restore the
   *  output to full level. */
  cancelScheduledAudioMute(): void {
    this.audioGraph?.cancelScheduledMute();
  }

  seek(time: number): void {
    this.el.currentTime = Math.max(0, Math.min(this.el.duration || Number.MAX_VALUE, time));
    this.store.setCurrentTime(this.el.currentTime);
  }

  currentVolume(): number {
    return this.el.volume;
  }

  setVolume(vol: number): void {
    this.el.volume = Math.max(0, Math.min(1, vol));
    this.store.setVolume(this.el.volume);
  }

  private stepByOutputDelta(outputDeltaSec: number): void {
    this.el.pause();
    const map = this.timeMap();
    const outputTime = map.toOutputTime(this.el.currentTime);
    const nextOutput = Math.max(0, outputTime + outputDeltaSec);
    const nextSource = this.clampToDuration(map.toSourceTime(nextOutput));
    this.el.currentTime = nextSource;
    this.store.setCurrentTime(nextSource);
  }

  private clampToDuration(time: number): number {
    const duration = this.el.duration;
    if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, time);
    return Math.max(0, Math.min(duration, time));
  }

  private timeMap(): RenderTimeMap {
    const currentCuts = this.store.snapshot().cuts;
    if (currentCuts !== this.cachedCutsRef) {
      this.cachedCutsRef = currentCuts;
      this.cachedTimeMap = new RenderTimeMap(currentCuts.list());
    }
    return this.cachedTimeMap;
  }

  // Pre-readyState seeks are no-ops; `onLoadedMetadata` retries once
  // duration resolves.
  private seekIfPossible(time: number): void {
    if (time <= 0) return;
    const duration = this.el.duration;
    const target = Number.isFinite(duration) && duration > 0
      ? Math.min(time, duration)
      : time;
    this.el.currentTime = target;
  }

  private readonly tick = (): void => {
    const t = this.el.currentTime;
    if (t !== this.lastPropagatedTime) {
      this.lastPropagatedTime = t;
      this.store.setCurrentTime(t);
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  private readonly onPlayStateChange = (): void => {
    this.store.setIsPlaying(!this.el.paused);
  };

  private readonly onVolumeChange = (): void => {
    this.store.setVolume(this.el.volume);
  };

  private readonly onLoadedMetadata = (): void => {
    this.store.setDuration(this.el.duration);
    this.updateLayout();
    if (this.el.currentTime === 0) {
      this.seekIfPossible(this.store.snapshot().video.currentTime);
    }
  };

  private readonly onLoadedData = (): void => {
    this.store.setIsVideoReady(true);
  };

  private readonly onEmptied = (): void => {
    this.store.setIsVideoReady(false);
    this.store.setVideoLoadError(null);
  };

  private readonly onError = (): void => {
    const err = this.el.error;
    if (!err) return;
    this.store.setVideoLoadError({ code: err.code, message: err.message });
    this.store.setIsVideoReady(false);
  };

  private readonly updateLayout = (): void => {
    const vw = this.el.videoWidth;
    const vh = this.el.videoHeight;
    if (vw === 0 || vh === 0) return;
    this.store.setVideoLayout({ width: vw, height: vh });
  };
}
