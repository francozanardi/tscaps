/**
 * One decoded video frame surfaced by a {@link VideoFrameDecoder}. The shape
 * is intentionally minimal so different decode strategies can share the same
 * downstream consumer.
 *
 * Callers must call {@link close} when they're done with the frame to
 * release the underlying GPU/CPU resources.
 */
export interface DecodedVideoFrame {
  /** Presentation timestamp, in seconds. */
  readonly timestamp: number;
  /** Frame duration, in seconds. */
  readonly duration: number;
  /**
   * Paints the frame into the given 2D context at `(dx, dy)` scaled to
   * `dWidth × dHeight`. The source rectangle is the full frame.
   */
  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
  close(): void;
}

/**
 * Pull-based source of decoded video frames. The decoder owns the lifetime
 * of any underlying resources it allocates and must be closed once
 * iteration ends, including on error.
 */
export interface VideoFrameDecoder {
  samples(): AsyncIterable<DecodedVideoFrame>;
  close(): void;
}
