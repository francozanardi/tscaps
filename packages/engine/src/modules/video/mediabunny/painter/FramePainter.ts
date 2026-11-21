import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

/** One output frame to paint: the decoded source frame and where it lands on the output timeline. */
export interface FramePaintRequest {
  readonly frame: DecodedVideoFrame;
  readonly outputTimestamp: number;
}

/**
 * Owns the pixel work for a single transcode run: what to draw into
 * every output frame's canvas. The transcode coordinator owns the
 * encode loop and decides *when* each frame runs; the painter decides
 * *what* the frame looks like.
 *
 * Lifecycle is per-run: {@link begin} once at the start with the
 * resolved output dimensions and source frame rate, {@link paint} for
 * each run of decoded frames, and {@link end} once at the end (called on
 * both success and failure). Instances are single-use unless the
 * concrete class documents otherwise.
 *
 * A transcode hands over its runs in monotonically advancing
 * source-time order, and a painter may rely on that. One built to paint
 * single frames out of sequence says so, and serves runs in any order.
 *
 * The two-step {@link paint} contract exists because
 * {@link VideoTrackEncoder.encode} takes a synchronous paint callback:
 * any work that has to be awaited (e.g. rasterizing a caption layer)
 * happens inside {@link paint}, and the returned closures run
 * synchronously against the encoder's canvas.
 */
export interface FramePainter {
  /**
   * Opens per-run resources (e.g. caption source, overlay raster) for
   * a run at the given output pixel dimensions. `fps` is the source
   * frame rate the coordinator resolved — implementations may cap or
   * quantize it as they see fit. `sourceWidth × sourceHeight` is the
   * source's own display size, whose shape the output's need not share.
   */
  begin(width: number, height: number, fps: number, sourceWidth: number, sourceHeight: number): Promise<void>;

  /**
   * How many consecutive frames the painter wants handed to one
   * {@link paint} call to work at its best. `1` means it is happy frame
   * by frame; a larger number means it amortizes work across the run,
   * and the caller should gather that many before painting — which
   * costs it holding them all until the run is painted and encoded.
   *
   * A preference, not a requirement: {@link paint} accepts any length,
   * and the last run of a render is short by nature. Meaningful only
   * after {@link begin}.
   */
  lookAhead(): number;

  /**
   * Resolves any state the run needs asynchronously and returns one
   * synchronous paint step per request, in the order given.
   *
   * Each request's `outputTimestamp` is that frame's presentation time
   * on the output timeline (already mapped through any skip ranges by
   * the caller); its `frame.timestamp` carries the source-timeline time
   * and stays authoritative for any lookup against source-aligned data
   * (captions, per-source overlays).
   *
   * The frames must stay open until every returned step has run.
   */
  paint(requests: ReadonlyArray<FramePaintRequest>): Promise<PaintFrame[]>;

  /**
   * Releases the per-run resources opened by {@link begin}. Called on
   * both success and failure paths of the enclosing run. Idempotent:
   * safe to call before or after {@link begin} succeeds.
   */
  end(): void;
}
