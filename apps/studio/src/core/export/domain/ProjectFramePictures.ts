/** The project's output frame at one moment. */
export interface ProjectFramePicture {
  /** The moment asked, in seconds of the source video. */
  readonly sourceSec: number;
  readonly bitmap: ImageBitmap;
}

/**
 * Pictures of the project's output frame, and what the caller should
 * know about them. A moment that could not be drawn is left out, and the
 * notes say why.
 */
export interface ProjectFramePictureSet {
  readonly frames: ReadonlyArray<ProjectFramePicture>;
  readonly width: number;
  readonly height: number;
  /** Anything that makes them differ from the exported video (a file not available yet, a moment cut away). */
  readonly notes: ReadonlyArray<string>;
}

/**
 * Draws the project as its export would, at chosen moments of the source
 * video, so whoever edits it can see the result; with `withCaptions`
 * false, the same pictures with no caption drawn, to see what the
 * captions go over. The caller closes the bitmaps.
 */
export interface ProjectFramePictures {
  renderAt(sourceSecs: ReadonlyArray<number>, signal: AbortSignal, withCaptions?: boolean): Promise<ProjectFramePictureSet>;
}
