/**
 * A single decoded video frame ready to be painted. Hides the
 * decoder behind a small set of attributes the painter needs:
 * the source timestamp, the intrinsic pixel size, and a bitmap
 * accepted by the Canvas 2D `drawImage` API.
 *
 * Frames are standalone: the bitmap is owned by the frame, not
 * by the decoder that produced it, so a frame stays valid for as
 * long as the holder needs it — including buffered for a later
 * paint. Each frame holds a live GPU/CPU resource that garbage
 * collection does not reliably release; the holder must call
 * {@link close} exactly once on every frame, painted or skipped.
 */
export interface PreviewVideoFrame {
  readonly timestampSec: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly bitmap: CanvasImageSource;
  close(): void;
}
