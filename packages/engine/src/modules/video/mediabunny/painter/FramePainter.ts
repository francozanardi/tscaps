import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

/**
 * Owns the pixel work for a single transcode run: what to draw into
 * every output frame's canvas. The transcode coordinator owns the
 * encode loop and decides *when* each frame runs; the painter decides
 * *what* the frame looks like.
 *
 * Lifecycle is per-run: {@link begin} once at the start with the
 * resolved output dimensions and source frame rate, {@link paint} for
 * each decoded frame in monotonically advancing source-time order, and
 * {@link end} once at the end (called on both success and failure).
 * Instances are single-use unless the concrete class documents
 * otherwise.
 *
 * The two-step {@link paint} contract exists because
 * {@link VideoTrackEncoder.encode} takes a synchronous paint callback:
 * any per-frame work that has to be awaited (e.g. rasterizing a
 * caption layer) happens inside {@link paint}, and the returned
 * closure runs synchronously against the encoder's canvas.
 */
export interface FramePainter {
  /**
   * Opens per-run resources (e.g. caption source, overlay raster) for
   * a run at the given output pixel dimensions. `fps` is the source
   * frame rate the coordinator resolved — implementations may cap or
   * quantize it as they see fit.
   */
  begin(width: number, height: number, fps: number): Promise<void>;

  /**
   * Resolves any per-frame state asynchronously and returns the
   * synchronous paint step the encoder will run. `outputTimestamp` is
   * the frame's presentation time on the output timeline (already
   * mapped through any skip ranges by the caller); `frame.timestamp`
   * carries the source-timeline time and stays authoritative for any
   * lookup against source-aligned data (captions, per-source overlays).
   */
  paint(frame: DecodedVideoFrame, outputTimestamp: number): Promise<PaintFrame>;

  /**
   * Releases the per-run resources opened by {@link begin}. Called on
   * both success and failure paths of the enclosing run. Idempotent:
   * safe to call before or after {@link begin} succeeds.
   */
  end(): void;
}
