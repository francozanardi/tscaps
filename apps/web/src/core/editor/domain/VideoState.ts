/**
 * Intrinsic dimensions of the video, captured from the `<video>` element once metadata loads.
 */
export interface VideoLayout {
  width: number;
  height: number;
}

/**
 * Failure captured from the `<video>` element's `error` event. `code`
 * matches `MediaError.code` (1: aborted, 2: network, 3: decode, 4:
 * src not supported).
 */
export interface VideoLoadError {
  code: number;
  message: string;
}

/**
 * Everything tied to the underlying video: its source, its load state, and
 * its live playback state. `file` / `url` are null until a video is loaded;
 * `volume` / `playbackRate` are user preferences that persist across resets.
 */
export interface VideoState {
  readonly file: File | null;
  readonly url: string | null;
  readonly layout: VideoLayout | null;
  /**
   * `true` once the `<video>` element has decoded enough data to render its
   * first frame (the `loadeddata` event).
   */
  readonly isReady: boolean;
  /** `null` while the video is loading or playing fine. */
  readonly loadError: VideoLoadError | null;
  readonly currentTime: number;
  readonly duration: number;
  readonly volume: number;
  readonly playbackRate: number;
  readonly isPlaying: boolean;
}
