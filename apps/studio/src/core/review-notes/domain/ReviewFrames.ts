/** The output frame at one moment. */
export interface ReviewFrame {
  /** The moment asked, in seconds of the source video. */
  readonly sourceSec: number;
  /** The frame at its full size. The receiver closes it. */
  readonly bitmap: ImageBitmap;
}

/** Pictures of the output frame, and how they differ from the export. */
export interface ReviewFrameSet {
  /** One per moment asked, except moments that could not be drawn. */
  readonly frames: ReadonlyArray<ReviewFrame>;
  readonly width: number;
  readonly height: number;
  /** Plain sentences on how the pictures differ from the export, or why one is missing. */
  readonly notes: ReadonlyArray<string>;
}

/** Draws the project's output frame as its export would, at moments of the source video. */
export interface ReviewFrames {
  renderAt(sourceSecs: ReadonlyArray<number>, signal: AbortSignal): Promise<ReviewFrameSet>;
}
