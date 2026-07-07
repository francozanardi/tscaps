/**
 * Intrinsic pixel size of the currently loaded video.
 */
export interface PreviewVideoSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Failure produced when opening a media file or decoding its
 * first frame. The message is suitable for user-facing copy.
 */
export interface PreviewLoadFailure {
  readonly message: string;
}

/**
 * Snapshot of a {@link VideoPreviewSurface}'s observable state.
 *
 * `currentTimeSec` is in **source time** — positions inside a cut
 * range are skipped over by the surface itself, so consumers never
 * observe a time that lands inside an active cut.
 */
export interface VideoPreviewSurfaceSnapshot {
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly isPlaying: boolean;
  readonly volume: number;
  readonly playbackRate: number;
  readonly videoSize: PreviewVideoSize | null;
  readonly isReady: boolean;
  readonly loadFailure: PreviewLoadFailure | null;
}

/**
 * Renderer-agnostic media player abstraction. Plays a video file
 * onto a presentation canvas, with audio routed through a Web Audio
 * graph the surface owns.
 *
 * The surface is cut-aware: `seek` and natural playback advance in
 * source time, but positions inside an active cut range are skipped
 * over transparently. Consumers operate as if cuts simply did not
 * exist in the timeline.
 *
 * Lifecycle:
 * - `start(canvas)` binds the surface to a presentation canvas and
 *   wires up the audio output. Subsequent calls with a different
 *   canvas swap the presentation target without losing the loaded
 *   source.
 * - `load(source)` opens a video blob and prepares decoding. Throws
 *   when the codec is not decodable in this browser.
 * - `unload()` releases the decoders and clears the canvas.
 * - `stop()` tears the runtime down; a later `start` rebuilds it.
 *
 * Emits two events:
 * - `'timechange'` — fired every time `currentTimeSec` advances
 *   during playback. High frequency.
 * - `'change'` — fired when any non-time field of the snapshot
 *   changes (play/pause, volume, rate, video size, ready, failure).
 */
export interface VideoPreviewSurface extends EventTarget {
  start(canvas: HTMLCanvasElement): void;
  stop(): void;

  load(source: Blob): Promise<void>;
  unload(): void;

  play(): Promise<void>;
  pause(): void;
  seek(sourceTimeSec: number): void;
  setVolume(level: number): void;
  setPlaybackRate(rate: number): void;

  /**
   * Open an interactive scrub session. While the session is
   * open, every {@link seek} call is routed through a persistent
   * decoder dedicated to the drag, so the per-tick cost collapses
   * to one decode instead of one decoder + decode + teardown.
   * Pair with {@link endScrub} on pointer release.
   */
  beginScrub(): void;

  /**
   * Close the scrub session started with {@link beginScrub}. The
   * final seek target's frame is painted as part of teardown.
   * Safe to call without a matching {@link beginScrub}.
   */
  endScrub(): void;

  /**
   * Schedule the audio output to drop to silence the moment the
   * playhead reaches the given source-time position. Replaces any
   * pending schedule.
   */
  scheduleAudioMuteAt(sourceTimeSec: number): void;

  /** Cancel any pending scheduled mute and restore the output level. */
  cancelScheduledAudioMute(): void;

  snapshot(): VideoPreviewSurfaceSnapshot;

  captureStream(): MediaStream | null;
}
