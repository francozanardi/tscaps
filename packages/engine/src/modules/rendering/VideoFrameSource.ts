/**
 * Sub-rectangle of a video frame, expressed in viewport pixels.
 * `(x, y)` is the top-left corner; `(x + width, y + height)` is the
 * bottom-right corner.
 */
export interface VideoFrameRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Pull-based access to the underlying video frame at a given moment
 * in playback time.
 */
export interface VideoFrameSource {
  /**
   * Resolves to a self-contained `data:` URL for the frame whose
   * presentation interval contains `timeSeconds`, encoded as JPEG
   * at the given quality (`0` lowest, `1` highest). When `region`
   * is supplied, only that sub-rectangle of the frame is encoded.
   *
   * Rejects when the requested time falls outside the source's
   * available range, or when the underlying decoder cannot produce
   * a frame at that timestamp.
   */
  getFrameAt(timeSeconds: number, jpegQuality: number, region?: VideoFrameRegion): Promise<string>;
}
