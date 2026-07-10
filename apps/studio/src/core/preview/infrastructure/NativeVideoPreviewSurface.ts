import { RenderTimeMap } from '@tscaps/engine';
import type {
  PreviewLoadFailure,
  PreviewVideoSize,
  VideoPreviewSurface,
  VideoPreviewSurfaceSnapshot,
} from '@core/preview/domain/VideoPreviewSurface';
import type { PreviewCutsSource, PreviewCutRange } from '@core/preview/domain/PreviewCutsSource';
import { MediaElementAudioGraph } from '@core/preview/infrastructure/MediaElementAudioGraph';

const TIME_DISPATCH_THRESHOLD_SEC = 0.001;

// Small forward nudge applied when landing "just past" a cut boundary.
// The `<video>` seek algorithm is not bit-exact — floating-point noise
// and mid-GOP interpolation can leave `currentTime` sitting a fraction
// of a millisecond *before* the requested `endSec`. Without the nudge
// the rAF tick would see us still inside the cut and re-fire the skip,
// causing a freeze loop where `currentTime` never actually progresses.
// 20ms is imperceptible at any reasonable frame rate and orders of
// magnitude larger than the observed drift.
const CUT_EXIT_MARGIN_SEC = 0.02;

/**
 * {@link VideoPreviewSurface} implementation backed by a native
 * `<video>` element. Delegates decoding, seeking and playback pacing
 * to the browser, and routes audio through a
 * {@link MediaElementAudioGraph} so scheduled mutes stay
 * sample-accurate on the audio rendering thread.
 *
 * Playback avoids the preview-proxy pipeline entirely: the source
 * blob is loaded verbatim, at its original resolution and codec,
 * relying on the browser's native codec support (which covers HEVC on
 * Safari, VP9/AV1 on Chrome, etc. — cases the WebCodecs-based
 * canvas surface would refuse). This makes the native surface the
 * right pick when proxy generation is prohibitively expensive
 * (long sources, low-end mobile) or unnecessary (broadly compatible
 * source codec, precision-insensitive editing).
 *
 * Precision tradeoff: cut boundaries are honoured by scheduling a
 * gain drop on the audio clock and a `currentTime` skip on
 * wall-clock via `setTimeout`, both re-anchored to the completion
 * of each seek (via the element's `seeked` event) so seek latency
 * does not accumulate into the timing of subsequent skips. Audio
 * is muted sample-accurate at the cut start; video may advance a
 * frame or two into the cut before the skip lands. Consumers that
 * need frame-accurate cut boundaries pick the canvas surface
 * instead.
 */
export class NativeVideoPreviewSurface extends EventTarget implements VideoPreviewSurface {

  private videoElement: HTMLVideoElement | null = null;
  private audioGraph: MediaElementAudioGraph | null = null;
  private detachCutsListener: (() => void) | null = null;

  private cachedRanges: ReadonlyArray<PreviewCutRange>;
  private cachedTimeMap: RenderTimeMap;

  private currentVolume = 1;
  private currentRate = 1;
  private isPlayingFlag = false;
  private isReadyFlag = false;
  private loadFailure: PreviewLoadFailure | null = null;
  private videoSize: PreviewVideoSize | null = null;
  private durationSec = 0;

  private sourceUrl: string | null = null;
  private lastObservedSourceTimeSec = 0;
  private scheduledSkipTimerId: number | null = null;
  private timeDispatchRafId = 0;
  private loadGeneration = 0;
  private isSeeking = false;

  constructor(private readonly cutsSource: PreviewCutsSource) {
    super();
    this.cachedRanges = [];
    this.cachedTimeMap = new RenderTimeMap(this.cachedRanges);
  }

  start(container: HTMLElement): void {
    if (this.videoElement) {
      this.reparentVideoElement(container);
      return;
    }
    const video = this.buildVideoElement();
    container.appendChild(video);
    this.videoElement = video;
    this.audioGraph = new MediaElementAudioGraph(video);
    this.audioGraph.setLevel(this.currentVolume);
    this.attachVideoElementListeners(video);
    this.refreshTimeMapFromSource();
    this.detachCutsListener = this.cutsSource.onRangesChanged(this.onCutsChanged);
    this.startTimeDispatchLoop();
  }

  stop(): void {
    this.unload();
    this.stopTimeDispatchLoop();
    this.detachCutsListener?.();
    this.detachCutsListener = null;
    if (this.videoElement) {
      this.detachVideoElementListeners(this.videoElement);
      this.videoElement.remove();
      this.videoElement = null;
    }
    if (this.audioGraph) {
      const graph = this.audioGraph;
      this.audioGraph = null;
      void graph.dispose();
    }
  }

  async load(source: Blob): Promise<void> {
    const video = this.videoElement;
    if (!video) throw new Error('Surface must be started before loading a source.');
    this.unload();
    const generation = ++this.loadGeneration;
    const url = URL.createObjectURL(source);
    this.sourceUrl = url;
    video.src = url;
    try {
      await this.waitForMetadataAndFirstFrame(video, generation);
      if (generation !== this.loadGeneration) return;
      this.videoSize = { widthPx: video.videoWidth, heightPx: video.videoHeight };
      this.durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      this.lastObservedSourceTimeSec = 0;
      this.isReadyFlag = true;
      this.loadFailure = null;
      this.dispatchChange();
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
    this.clearScheduledSkip();
    this.audioGraph?.cancelScheduledMute();
    this.isSeeking = false;
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }
    if (this.sourceUrl) {
      URL.revokeObjectURL(this.sourceUrl);
      this.sourceUrl = null;
    }
    this.videoSize = null;
    this.durationSec = 0;
    this.lastObservedSourceTimeSec = 0;
    this.isReadyFlag = false;
    this.isPlayingFlag = false;
    this.dispatchChange();
  }

  async play(): Promise<void> {
    if (!this.videoElement || this.isPlayingFlag || !this.isReadyFlag) return;
    await this.audioGraph?.resumeIfSuspended();
    this.rewindIfParkedAtEnd();
    try {
      await this.videoElement.play();
    } catch {
      return;
    }
    this.isPlayingFlag = true;
    this.armNextCutSkip();
    this.dispatchChange();
  }

  pause(): void {
    if (!this.videoElement || !this.isPlayingFlag) return;
    this.videoElement.pause();
    this.isPlayingFlag = false;
    this.clearScheduledSkip();
    this.audioGraph?.cancelScheduledMute();
    this.lastObservedSourceTimeSec = this.videoElement.currentTime;
    this.dispatchChange();
  }

  seek(sourceTimeSec: number): void {
    if (!this.videoElement) return;
    const target = this.resolveSeekTarget(sourceTimeSec);
    this.seekVideoElementTo(target);
    this.dispatchTimeChange();
  }

  beginScrub(): void {
    // A native `<video>` seeks directly against the browser's own decoder;
    // there is no persistent scrub decoder to open or close.
  }

  endScrub(): void {
    // See {@link beginScrub}.
  }

  setVolume(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.currentVolume = clamped;
    this.audioGraph?.setLevel(clamped);
    if (this.isPlayingFlag) this.armNextCutSkip();
    this.dispatchChange();
  }

  scheduleAudioMuteAt(sourceTimeSec: number): void {
    if (!this.audioGraph) return;
    const wallClockDelay = this.wallClockSecondsUntilSourceTime(sourceTimeSec);
    this.audioGraph.scheduleMuteIn(wallClockDelay);
  }

  cancelScheduledAudioMute(): void {
    this.audioGraph?.cancelScheduledMute();
  }

  setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.01, rate);
    this.currentRate = clamped;
    if (this.videoElement) this.videoElement.playbackRate = clamped;
    if (this.isPlayingFlag) this.armNextCutSkip();
    this.dispatchChange();
  }

  snapshot(): VideoPreviewSurfaceSnapshot {
    return {
      currentTimeSec: this.lastObservedSourceTimeSec,
      durationSec: this.durationSec,
      isPlaying: this.isPlayingFlag,
      volume: this.currentVolume,
      playbackRate: this.currentRate,
      videoSize: this.videoSize,
      isReady: this.isReadyFlag,
      loadFailure: this.loadFailure,
    };
  }

  captureStream(): MediaStream | null {
    if (!this.videoElement) return null;
    const candidate = this.videoElement as HTMLVideoElement & { captureStream?: () => MediaStream };
    if (typeof candidate.captureStream !== 'function') return null;
    return candidate.captureStream();
  }

  private buildVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.playsInline = true;
    video.controls = false;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.style.display = 'block';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    return video;
  }

  private reparentVideoElement(container: HTMLElement): void {
    if (!this.videoElement) return;
    if (this.videoElement.parentElement === container) return;
    container.appendChild(this.videoElement);
  }

  private attachVideoElementListeners(video: HTMLVideoElement): void {
    video.addEventListener('error', this.onVideoError);
    video.addEventListener('ended', this.onVideoEnded);
    video.addEventListener('seeked', this.onVideoSeeked);
  }

  private detachVideoElementListeners(video: HTMLVideoElement): void {
    video.removeEventListener('error', this.onVideoError);
    video.removeEventListener('ended', this.onVideoEnded);
    video.removeEventListener('seeked', this.onVideoSeeked);
  }

  private seekVideoElementTo(sourceTimeSec: number): void {
    if (!this.videoElement) return;
    this.isSeeking = true;
    this.clearScheduledSkip();
    this.audioGraph?.cancelScheduledMute();
    this.videoElement.currentTime = sourceTimeSec;
    this.lastObservedSourceTimeSec = sourceTimeSec;
  }

  private readonly onVideoSeeked = (): void => {
    if (!this.isSeeking) return;
    this.isSeeking = false;
    if (this.isPlayingFlag) this.armNextCutSkip();
  };

  private waitForMetadataAndFirstFrame(video: HTMLVideoElement, generation: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
      };
      const onLoadedData = (): void => {
        cleanup();
        if (generation !== this.loadGeneration) { resolve(); return; }
        resolve();
      };
      const onError = (): void => {
        cleanup();
        reject(this.buildMediaErrorReason(video));
      };
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('error', onError);
    });
  }

  private buildMediaErrorReason(video: HTMLVideoElement): Error {
    const err = video.error;
    if (!err) return new Error('Failed to load video source.');
    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED: return new Error('Loading was aborted.');
      case MediaError.MEDIA_ERR_NETWORK: return new Error('A network error prevented loading the video.');
      case MediaError.MEDIA_ERR_DECODE:  return new Error('The video could not be decoded.');
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: return new Error('The video format is not supported by this browser.');
      default: return new Error(err.message || 'Failed to load video source.');
    }
  }

  private readonly onVideoError = (): void => {
    if (!this.videoElement) return;
    this.loadFailure = this.toLoadFailure(this.buildMediaErrorReason(this.videoElement));
    this.isReadyFlag = false;
    this.dispatchChange();
  };

  private readonly onVideoEnded = (): void => {
    this.isPlayingFlag = false;
    this.clearScheduledSkip();
    this.audioGraph?.cancelScheduledMute();
    if (this.videoElement) this.lastObservedSourceTimeSec = this.videoElement.currentTime;
    this.dispatchChange();
  };

  private refreshTimeMapFromSource(): void {
    const ranges = this.cutsSource.getRanges();
    if (ranges === this.cachedRanges) return;
    this.cachedRanges = ranges;
    this.cachedTimeMap = new RenderTimeMap(ranges);
  }

  private readonly onCutsChanged = (): void => {
    this.cachedRanges = this.cutsSource.getRanges();
    this.cachedTimeMap = new RenderTimeMap(this.cachedRanges);
    if (!this.videoElement) return;
    const containing = this.findContainingCut(this.videoElement.currentTime);
    if (containing) {
      this.seekVideoElementTo(this.clampToDuration(this.computeCutExitTargetSec(containing)));
      this.dispatchTimeChange();
      return;
    }
    if (this.isPlayingFlag) this.armNextCutSkip();
  };

  private resolveSeekTarget(sourceTimeSec: number): number {
    const containing = this.findContainingCut(sourceTimeSec);
    const raw = containing ? this.computeCutExitTargetSec(containing) : sourceTimeSec;
    return this.clampToDuration(raw);
  }

  private computeCutExitTargetSec(cut: PreviewCutRange): number {
    return cut.endSec + CUT_EXIT_MARGIN_SEC;
  }

  private clampToDuration(sourceTimeSec: number): number {
    if (this.durationSec <= 0) return Math.max(0, sourceTimeSec);
    return Math.max(0, Math.min(this.durationSec, sourceTimeSec));
  }

  private findContainingCut(sourceTimeSec: number): PreviewCutRange | null {
    return this.cachedTimeMap.findContainingRange(sourceTimeSec);
  }

  private findNextCutAfter(sourceTimeSec: number): PreviewCutRange | null {
    let best: PreviewCutRange | null = null;
    for (const range of this.cachedRanges) {
      if (range.startSec <= sourceTimeSec) continue;
      if (best === null || range.startSec < best.startSec) best = range;
    }
    return best;
  }

  private armNextCutSkip(): void {
    if (!this.videoElement || this.isSeeking) return;
    this.clearScheduledSkip();
    this.audioGraph?.cancelScheduledMute();
    const currentSourceTime = this.videoElement.currentTime;
    const nextCut = this.findNextCutAfter(currentSourceTime);
    if (!nextCut) return;
    const wallClockDelay = (nextCut.startSec - currentSourceTime) / this.currentRate;
    if (wallClockDelay <= 0) {
      this.skipPastCut(nextCut);
      return;
    }
    this.audioGraph?.scheduleMuteIn(wallClockDelay);
    this.scheduledSkipTimerId = window.setTimeout(() => {
      this.scheduledSkipTimerId = null;
      this.skipPastCut(nextCut);
    }, wallClockDelay * 1000);
  }

  private skipPastCut(cut: PreviewCutRange): void {
    if (!this.videoElement) return;
    const target = this.clampToDuration(this.computeCutExitTargetSec(cut));
    this.seekVideoElementTo(target);
    this.dispatchTimeChange();
  }

  private clearScheduledSkip(): void {
    if (this.scheduledSkipTimerId === null) return;
    window.clearTimeout(this.scheduledSkipTimerId);
    this.scheduledSkipTimerId = null;
  }

  private wallClockSecondsUntilSourceTime(sourceTimeSec: number): number {
    if (!this.videoElement) return 0;
    const delta = sourceTimeSec - this.videoElement.currentTime;
    return delta / this.currentRate;
  }

  private rewindIfParkedAtEnd(): void {
    if (!this.videoElement) return;
    if (this.durationSec <= 0) return;
    if (this.videoElement.currentTime < this.durationSec) return;
    this.seekVideoElementTo(0);
    this.dispatchTimeChange();
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
    if (!this.videoElement || !this.isPlayingFlag || this.isSeeking) return;
    const containing = this.findContainingCut(this.videoElement.currentTime);
    if (containing) {
      this.skipPastCut(containing);
      return;
    }
    const next = this.videoElement.currentTime;
    if (Math.abs(next - this.lastObservedSourceTimeSec) < TIME_DISPATCH_THRESHOLD_SEC) return;
    this.lastObservedSourceTimeSec = next;
    this.dispatchTimeChange();
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
