import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { RenderTimeMap } from '@tscaps/engine';
import type {
  VideoPreviewSurface,
  VideoPreviewSurfaceSnapshot,
} from '@core/preview/domain/VideoPreviewSurface';
import type { VideoLoadError } from '@core/editor/domain/VideoState';

const FRAME_S = 1 / 30;
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const LOAD_FAILURE_CODE = 4;

/**
 * Operates the editor's media playback through a
 * {@link VideoPreviewSurface}: forwards playback commands, syncs
 * the surface's observable state onto the editor store, and
 * answers semantic navigation requests (frame stepping, word and
 * segment jumps) by translating between source and output time
 * via the live {@link RenderTimeMap}.
 *
 * Owns no audio graph and no `<video>` element — the surface
 * encapsulates both, including cut-aware presentation. Audio mute
 * scheduling is exposed as a passthrough for the in-progress cut
 * selection preview.
 *
 * On `start`, the persisted `currentTime` is held aside and
 * applied as a seek the moment the surface signals `isReady` —
 * preserving the playhead position carried by a loaded project
 * against the surface's natural fresh-start at output zero.
 */
export class VideoController {

  private cachedCutsRef: CutRegistry | null = null;
  private cachedTimeMap = new RenderTimeMap([]);
  private pendingInitialSeekSec: number | null = null;

  constructor(
    private readonly surface: VideoPreviewSurface,
    private readonly store: EditorStore,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder,
  ) {}

  start(): void {
    this.armInitialSeekFromStoredTime();
    this.applyStoredPreferencesToSurface();
    this.surface.addEventListener('change', this.onSurfaceChange);
    this.surface.addEventListener('timechange', this.onSurfaceTimeChange);
    this.publishFullSnapshot();
    this.tryConsumeInitialSeek();
  }

  stop(): void {
    this.surface.removeEventListener('change', this.onSurfaceChange);
    this.surface.removeEventListener('timechange', this.onSurfaceTimeChange);
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
    const currentTime = this.surface.snapshot().currentTimeSec;
    const words = doc.getWords();
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i]!.time.isBefore(currentTime)) { this.seek(words[i]!.time.midpoint); return; }
    }
  }

  nextWord(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.surface.snapshot().currentTimeSec;
    const next = doc.getWords().find(w => w.time.isAfter(currentTime));
    if (next) this.seek(next.time.midpoint);
  }

  prevSegment(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.surface.snapshot().currentTimeSec;
    const segs = doc.getSegments();
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i]!.time.isBefore(currentTime)) { this.seek(segs[i]!.time.midpoint); return; }
    }
  }

  nextSegment(): void {
    const doc = this.visibleDocument();
    if (!doc) return;
    const currentTime = this.surface.snapshot().currentTimeSec;
    const next = doc.getSegments().find(s => s.time.isAfter(currentTime));
    if (next) this.seek(next.time.midpoint);
  }

  setPlaybackRate(rate: number): void {
    this.surface.setPlaybackRate(rate);
  }

  changePlaybackRate(delta: number): void {
    const current = this.store.snapshot().video.playbackRate;
    const idx = SPEEDS.findIndex(s => Math.abs(s - current) < 0.01);
    const base = idx === -1 ? SPEEDS.indexOf(1) : idx;
    const nextIndex = Math.max(0, Math.min(SPEEDS.length - 1, base + delta));
    this.setPlaybackRate(SPEEDS[nextIndex]!);
  }

  togglePlay(): void {
    if (this.surface.snapshot().isPlaying) {
      this.surface.pause();
      return;
    }
    this.play();
  }

  play(): void {
    void this.surface.play().catch(() => { /* surface owns its error reporting */ });
  }

  pause(): void {
    this.surface.pause();
  }

  scheduleAudioMuteAt(sourceTimeSec: number): void {
    this.surface.scheduleAudioMuteAt(sourceTimeSec);
  }

  cancelScheduledAudioMute(): void {
    this.surface.cancelScheduledAudioMute();
  }

  seek(time: number): void {
    this.surface.seek(time);
  }

  beginScrub(): void {
    this.surface.beginScrub();
  }

  endScrub(): void {
    this.surface.endScrub();
  }

  currentVolume(): number {
    return this.surface.snapshot().volume;
  }

  setVolume(vol: number): void {
    this.surface.setVolume(vol);
  }

  private readonly onSurfaceChange = (): void => {
    this.publishFullSnapshot();
    this.tryConsumeInitialSeek();
  };

  private readonly onSurfaceTimeChange = (): void => {
    if (this.pendingInitialSeekSec !== null) return;
    this.store.setCurrentTime(this.surface.snapshot().currentTimeSec);
  };

  private publishFullSnapshot(): void {
    const snap = this.surface.snapshot();
    if (this.pendingInitialSeekSec === null) {
      this.store.setCurrentTime(snap.currentTimeSec);
    }
    this.store.patchVideoState({
      duration: snap.durationSec,
      isPlaying: snap.isPlaying,
      volume: snap.volume,
      playbackRate: snap.playbackRate,
      isReady: snap.isReady,
      loadError: this.toVideoLoadError(snap),
    });
  }

  private toVideoLoadError(snap: VideoPreviewSurfaceSnapshot): VideoLoadError | null {
    if (!snap.loadFailure) return null;
    return { code: LOAD_FAILURE_CODE, message: snap.loadFailure.message };
  }

  private armInitialSeekFromStoredTime(): void {
    const stored = this.store.snapshot().video.currentTime;
    this.pendingInitialSeekSec = stored > 0 ? stored : null;
  }

  private tryConsumeInitialSeek(): void {
    if (this.pendingInitialSeekSec === null) return;
    if (!this.surface.snapshot().isReady) return;
    const seekTo = this.pendingInitialSeekSec;
    this.pendingInitialSeekSec = null;
    this.surface.seek(seekTo);
  }

  private applyStoredPreferencesToSurface(): void {
    const v = this.store.snapshot().video;
    this.surface.setVolume(v.volume);
    this.surface.setPlaybackRate(v.playbackRate);
  }

  private visibleDocument() {
    const { document, cuts } = this.store.snapshot();
    if (!document) return null;
    return this.cutAwareDocumentBuilder.build(document, cuts);
  }

  private stepByOutputDelta(outputDeltaSec: number): void {
    this.surface.pause();
    const sourceCurrent = this.surface.snapshot().currentTimeSec;
    const map = this.timeMap();
    const outputCurrent = map.toOutputTime(sourceCurrent);
    const nextOutput = Math.max(0, outputCurrent + outputDeltaSec);
    const nextSource = this.clampToDuration(map.toSourceTime(nextOutput));
    this.seek(nextSource);
  }

  private clampToDuration(time: number): number {
    const duration = this.surface.snapshot().durationSec;
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
}
