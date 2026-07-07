import { RenderTimeMap } from '@tscaps/engine';
import type {
  PreviewLoadFailure,
  VideoPreviewSurface,
  VideoPreviewSurfaceSnapshot,
} from '@core/preview/domain/VideoPreviewSurface';
import type { PreviewCutsSource, PreviewCutRange } from '@core/preview/domain/PreviewCutsSource';
import type { PreviewSourceLoader } from '@core/preview/domain/PreviewSourceLoader';
import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';
import type { PlaybackClock } from '@core/preview/domain/PlaybackClock';
import type { VideoFramePump } from '@core/preview/domain/VideoFramePump';
import type { AudioSamplePump } from '@core/preview/domain/AudioSamplePump';
import { CanvasFramePainter } from '@core/preview/infrastructure/CanvasFramePainter';
import { AudioContextPlaybackClock } from '@core/preview/infrastructure/AudioContextPlaybackClock';
import { WebAudioAudioSamplePump } from '@core/preview/infrastructure/WebAudioAudioSamplePump';
import { RafVideoFramePump } from '@core/preview/infrastructure/RafVideoFramePump';
import { PreviewMemoryPressureLogger } from '@core/preview/infrastructure/PreviewMemoryPressureLogger';
import { MainThreadLongTaskLogger } from '@core/preview/infrastructure/MainThreadLongTaskLogger';
import type { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';

const TIME_DISPATCH_THRESHOLD_SEC = 0.001;
const MEMORY_DIAGNOSTICS_ENABLED = false;
const LONG_TASK_DIAGNOSTICS_ENABLED = false;

interface AudioRuntime {
  readonly context: AudioContext;
  readonly gain: GainNode;
}

interface PlaybackRuntime {
  readonly painter: CanvasFramePainter;
  readonly audio: AudioRuntime;
  readonly clock: PlaybackClock;
}

interface LoadedRuntime {
  readonly source: OpenedPreviewSource;
  readonly videoPump: VideoFramePump;
  readonly audioPump: AudioSamplePump | null;
}

/**
 * Default {@link VideoPreviewSurface} implementation. Composes a
 * canvas painter, a unified playback clock, and a pair of pumps
 * that decode video and audio through the
 * {@link PreviewSourceLoader} port.
 *
 * Internally tracks playback in output time and translates to
 * source time at the snapshot boundary, so consumers see a
 * timeline that already excludes cut ranges.
 *
 * The surface holds its own {@link RenderTimeMap} and rebuilds it
 * only when the {@link PreviewCutsSource} reports a new range list.
 * On every such change the playback clock is re-anchored to the
 * equivalent output time of the current source position, and the
 * pumps restart, so audio and video stay in lockstep with the new
 * timeline.
 *
 * `start(canvas)` builds the runtime on first call and just swaps
 * the painter's canvas on subsequent calls — survives canvas
 * remounts without losing the loaded source. `stop()` tears the
 * runtime down; a later `start` rebuilds it from scratch.
 */
export class CanvasVideoPreviewSurface extends EventTarget implements VideoPreviewSurface {

  private runtime: PlaybackRuntime | null = null;
  private loaded: LoadedRuntime | null = null;
  private currentCanvas: HTMLCanvasElement | null = null;
  private timeDispatchRafId = 0;
  private detachCutsListener: (() => void) | null = null;
  private memoryPressureLogger: PreviewMemoryPressureLogger | null = null;
  private longTaskLogger: MainThreadLongTaskLogger | null = null;

  private cachedRanges: ReadonlyArray<PreviewCutRange>;
  private cachedTimeMap: RenderTimeMap;

  private currentOutputTimeSec = 0;
  private currentVolume = 1;
  private currentRate = 1;
  private isPlayingFlag = false;
  private isScrubbingFlag = false;
  private isReadyFlag = false;
  private loadFailure: PreviewLoadFailure | null = null;
  private loadGeneration = 0;

  constructor(
    private readonly loader: PreviewSourceLoader,
    private readonly cutsSource: PreviewCutsSource,
    private readonly resolutionCap: PreviewResolutionCap,
  ) {
    super();
    this.cachedRanges = [];
    this.cachedTimeMap = new RenderTimeMap(this.cachedRanges);
  }

  start(canvas: HTMLCanvasElement): void {
    if (this.runtime) {
      this.runtime.painter.setCanvas(canvas);
      this.currentCanvas = canvas;
      return;
    }
    const audio = this.buildAudioRuntime();
    const painter = new CanvasFramePainter(canvas, this.resolutionCap);
    const clock = new AudioContextPlaybackClock(audio.context);
    clock.setRate(this.currentRate);
    this.runtime = { painter, audio, clock };
    this.currentCanvas = canvas;
    this.refreshTimeMapFromSource();
    this.detachCutsListener = this.cutsSource.onRangesChanged(this.onCutsChanged);
    this.startTimeDispatchLoop();
    this.startMemoryDiagnosticsIfEnabled();
    this.startLongTaskDiagnosticsIfEnabled();
  }

  private startMemoryDiagnosticsIfEnabled(): void {
    if (!MEMORY_DIAGNOSTICS_ENABLED) return;
    this.memoryPressureLogger = new PreviewMemoryPressureLogger();
    this.memoryPressureLogger.start();
  }

  private startLongTaskDiagnosticsIfEnabled(): void {
    if (!LONG_TASK_DIAGNOSTICS_ENABLED) return;
    this.longTaskLogger = new MainThreadLongTaskLogger();
    this.longTaskLogger.start();
  }

  private refreshTimeMapFromSource(): void {
    const ranges = this.cutsSource.getRanges();
    if (ranges === this.cachedRanges) return;
    this.cachedRanges = ranges;
    this.cachedTimeMap = new RenderTimeMap(ranges);
  }

  stop(): void {
    this.unload();
    this.stopTimeDispatchLoop();
    this.detachCutsListener?.();
    this.detachCutsListener = null;
    this.memoryPressureLogger?.stop();
    this.memoryPressureLogger = null;
    this.longTaskLogger?.stop();
    this.longTaskLogger = null;
    if (this.runtime) {
      const context = this.runtime.audio.context;
      this.runtime = null;
      this.currentCanvas = null;
      void context.close().catch(() => { /* already closed */ });
    }
  }

  async load(source: Blob): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) throw new Error('Surface must be started before loading a source.');
    this.unload();
    const generation = ++this.loadGeneration;
    try {
      const opened = await this.loader.open(source);
      if (generation !== this.loadGeneration) {
        opened.dispose();
        return;
      }
      this.prepareLoadedSource(runtime, opened);
      await this.paintInitialFrame();
      if (generation !== this.loadGeneration) return;
      await this.primeAudioDecoder();
      if (generation !== this.loadGeneration) return;
      this.markReadyAndDispatch();
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      this.loadFailure = this.toLoadFailure(err);
      this.isReadyFlag = false;
      this.dispatchChange();
      throw err;
    }
  }

  unload(): void {
    this.loadGeneration++;
    if (this.loaded) {
      this.loaded.videoPump.cancel();
      this.loaded.audioPump?.cancel();
      this.loaded.source.dispose();
      this.loaded = null;
    }
    this.isReadyFlag = false;
    this.isPlayingFlag = false;
    this.currentOutputTimeSec = 0;
    if (this.runtime) {
      this.runtime.clock.seek(0);
      this.runtime.painter.clear();
    }
    this.dispatchChange();
  }

  async play(): Promise<void> {
    if (!this.runtime || !this.loaded || this.isPlayingFlag) return;
    await this.ensureAudioContextRunning();
    this.rewindIfParkedAtEnd();
    this.runtime.clock.play(this.currentOutputTimeSec);
    this.loaded.videoPump.startFromOutputTime(this.currentOutputTimeSec);
    this.loaded.audioPump?.startFromOutputTime(this.currentOutputTimeSec);
    this.isPlayingFlag = true;
    this.dispatchChange();
  }

  private rewindIfParkedAtEnd(): void {
    if (!this.runtime) return;
    const durationOutputSec = this.computeDurationOutputSec();
    if (durationOutputSec <= 0) return;
    if (this.currentOutputTimeSec < durationOutputSec) return;
    this.currentOutputTimeSec = 0;
    this.runtime.clock.seek(0);
    this.dispatchTimeChange();
  }

  pause(): void {
    if (!this.runtime || !this.isPlayingFlag) return;
    this.runtime.clock.pause();
    this.currentOutputTimeSec = this.runtime.clock.currentOutputTimeSec();
    this.loaded?.videoPump.cancel();
    this.loaded?.audioPump?.cancel();
    this.isPlayingFlag = false;
    this.dispatchChange();
  }

  seek(sourceTimeSec: number): void {
    if (!this.runtime || !this.loaded) return;
    const outputSec = this.resolveSeekTarget(sourceTimeSec);
    this.runtime.clock.seek(outputSec);
    this.currentOutputTimeSec = outputSec;
    if (this.isPlayingFlag) {
      this.loaded.videoPump.startFromOutputTime(outputSec);
      this.loaded.audioPump?.startFromOutputTime(outputSec);
    } else if (this.isScrubbingFlag) {
      this.loaded.videoPump.paintScrubFrameAt(outputSec);
    } else {
      void this.loaded.videoPump.paintSingleFrameAt(outputSec);
    }
    this.dispatchTimeChange();
  }

  beginScrub(): void {
    if (this.isScrubbingFlag) return;
    this.isScrubbingFlag = true;
    this.loaded?.videoPump.beginScrubSession();
  }

  endScrub(): void {
    if (!this.isScrubbingFlag) return;
    this.isScrubbingFlag = false;
    this.loaded?.videoPump.endScrubSession();
  }

  setVolume(level: number): void {
    this.currentVolume = Math.max(0, Math.min(1, level));
    if (this.runtime) this.runtime.audio.gain.gain.value = this.currentVolume;
    this.dispatchChange();
  }

  scheduleAudioMuteAt(sourceTimeSec: number): void {
    if (!this.runtime) return;
    const outputSec = this.getTimeMap().toOutputTime(sourceTimeSec);
    const audioContextSec = this.runtime.clock.audioContextTimeForOutputTime(outputSec);
    const gain = this.runtime.audio.gain.gain;
    const now = this.runtime.audio.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(this.currentVolume, now);
    gain.setValueAtTime(0, Math.max(now, audioContextSec));
  }

  cancelScheduledAudioMute(): void {
    if (!this.runtime) return;
    const gain = this.runtime.audio.gain.gain;
    const now = this.runtime.audio.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(this.currentVolume, now);
  }

  setPlaybackRate(rate: number): void {
    this.currentRate = Math.max(0.01, rate);
    if (!this.runtime) return;
    this.runtime.clock.setRate(this.currentRate);
    if (this.isPlayingFlag && this.loaded) {
      this.currentOutputTimeSec = this.runtime.clock.currentOutputTimeSec();
      this.loaded.videoPump.startFromOutputTime(this.currentOutputTimeSec);
      this.loaded.audioPump?.startFromOutputTime(this.currentOutputTimeSec);
    }
    this.dispatchChange();
  }

  snapshot(): VideoPreviewSurfaceSnapshot {
    const sourceTime = this.getTimeMap().toSourceTime(this.currentOutputTimeSec);
    return {
      currentTimeSec: sourceTime,
      durationSec: this.loaded ? this.loaded.source.durationSec : 0,
      isPlaying: this.isPlayingFlag,
      volume: this.currentVolume,
      playbackRate: this.currentRate,
      videoSize: this.loaded
        ? { widthPx: this.loaded.source.widthPx, heightPx: this.loaded.source.heightPx }
        : null,
      isReady: this.isReadyFlag,
      loadFailure: this.loadFailure,
    };
  }

  captureStream(): MediaStream | null {
    const canvas = this.currentCanvas;
    if (!canvas) return null;
    const candidate = canvas as HTMLCanvasElement & { captureStream?: () => MediaStream };
    if (typeof candidate.captureStream !== 'function') return null;
    return candidate.captureStream();
  }

  private getTimeMap(): RenderTimeMap {
    return this.cachedTimeMap;
  }

  private readonly onCutsChanged = (): void => {
    const previousMap = this.cachedTimeMap;
    const previousSourceTime = previousMap.toSourceTime(this.currentOutputTimeSec);
    this.cachedRanges = this.cutsSource.getRanges();
    this.cachedTimeMap = new RenderTimeMap(this.cachedRanges);
    const sourceAfterCuts = this.cachedTimeMap.findContainingRange(previousSourceTime)?.endSec
      ?? previousSourceTime;
    const newOutputSec = this.cachedTimeMap.toOutputTime(sourceAfterCuts);
    this.currentOutputTimeSec = newOutputSec;
    if (this.runtime) this.runtime.clock.seek(newOutputSec);
    if (this.isPlayingFlag && this.loaded) {
      this.loaded.videoPump.startFromOutputTime(newOutputSec);
      this.loaded.audioPump?.startFromOutputTime(newOutputSec);
    } else if (this.loaded) {
      void this.loaded.videoPump.paintSingleFrameAt(newOutputSec);
    }
    this.dispatchTimeChange();
  };

  private buildAudioRuntime(): AudioRuntime {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = this.currentVolume;
    gain.connect(context.destination);
    return { context, gain };
  }

  private prepareLoadedSource(runtime: PlaybackRuntime, source: OpenedPreviewSource): void {
    runtime.painter.setIntrinsicSize(source.widthPx, source.heightPx);
    const readTimeMap = (): RenderTimeMap => this.getTimeMap();
    const videoPump = new RafVideoFramePump(source.videoTrack, runtime.painter, runtime.clock, readTimeMap);
    const audioPump = source.audioTrack
      ? new WebAudioAudioSamplePump(source.audioTrack, runtime.audio.context, runtime.audio.gain, runtime.clock, readTimeMap)
      : null;
    this.loaded = { source, videoPump, audioPump };
    this.loadFailure = null;
    this.currentOutputTimeSec = 0;
    runtime.clock.seek(0);
  }

  private markReadyAndDispatch(): void {
    this.isReadyFlag = true;
    this.dispatchChange();
  }

  private async paintInitialFrame(): Promise<void> {
    if (!this.loaded) return;
    await this.loaded.videoPump.paintSingleFrameAt(0);
  }

  private async primeAudioDecoder(): Promise<void> {
    if (!this.loaded?.audioPump) return;
    await this.loaded.audioPump.primeFirstFrame();
  }

  private resolveSeekTarget(sourceTimeSec: number): number {
    const map = this.getTimeMap();
    const adjusted = map.findContainingRange(sourceTimeSec)?.endSec ?? sourceTimeSec;
    const outputSec = map.toOutputTime(adjusted);
    const durationOutputSec = this.computeDurationOutputSec();
    return Math.max(0, Math.min(durationOutputSec, outputSec));
  }

  private computeDurationOutputSec(): number {
    if (!this.loaded) return 0;
    const skipped = this.getTimeMap().totalSkipDuration();
    return Math.max(0, this.loaded.source.durationSec - skipped);
  }

  private async ensureAudioContextRunning(): Promise<void> {
    if (!this.runtime) return;
    if (this.runtime.audio.context.state !== 'suspended') return;
    await this.runtime.audio.context.resume();
  }

  private startTimeDispatchLoop(): void {
    const tick = (): void => {
      this.timeDispatchRafId = requestAnimationFrame(tick);
      this.publishCurrentTimeIfMoved();
    };
    this.timeDispatchRafId = requestAnimationFrame(tick);
  }

  private stopTimeDispatchLoop(): void {
    cancelAnimationFrame(this.timeDispatchRafId);
    this.timeDispatchRafId = 0;
  }

  private publishCurrentTimeIfMoved(): void {
    if (!this.runtime || !this.runtime.clock.isRunning()) return;
    if (this.pauseIfEndOfTimelineReached()) return;
    const next = this.runtime.clock.currentOutputTimeSec();
    if (Math.abs(next - this.currentOutputTimeSec) < TIME_DISPATCH_THRESHOLD_SEC) return;
    this.currentOutputTimeSec = next;
    this.dispatchTimeChange();
  }

  private pauseIfEndOfTimelineReached(): boolean {
    if (!this.runtime || !this.loaded) return false;
    const durationOutputSec = this.computeDurationOutputSec();
    if (durationOutputSec <= 0) return false;
    if (this.runtime.clock.currentOutputTimeSec() < durationOutputSec) return false;
    this.snapPlaybackToEnd(durationOutputSec);
    return true;
  }

  private snapPlaybackToEnd(durationOutputSec: number): void {
    if (!this.runtime || !this.loaded) return;
    this.runtime.clock.pause();
    this.runtime.clock.seek(durationOutputSec);
    this.currentOutputTimeSec = durationOutputSec;
    this.loaded.videoPump.cancel();
    this.loaded.audioPump?.cancel();
    this.isPlayingFlag = false;
    this.dispatchTimeChange();
    this.dispatchChange();
  }

  private dispatchChange(): void {
    this.dispatchEvent(new Event('change'));
  }

  private dispatchTimeChange(): void {
    this.dispatchEvent(new Event('timechange'));
  }

  private toLoadFailure(err: unknown): PreviewLoadFailure {
    return { message: err instanceof Error ? err.message : String(err) };
  }
}
