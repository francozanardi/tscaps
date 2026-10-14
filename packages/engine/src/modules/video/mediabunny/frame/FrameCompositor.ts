import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { SubtitleFrame } from '@modules/rendering/SubtitleFrameRenderer';
import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { CaptionLayer } from '@modules/rendering/types/CaptionLayer';

/** One caption layer's raster at one frame, and the layer it paints, which says where and how it is composited. */
export interface CaptionLayerFrame {
  readonly layer: CaptionLayer;
  readonly frame: SubtitleFrame;
}

/**
 * The inputs the compositor needs to produce one output frame: the
 * decoded source frame, the per-timestamp caption layers, the
 * frame-invariant overlay, an optional top actor-cutout layer, and
 * the target dimensions. Layer order is the compositor's call, not
 * the request's.
 */
export interface FrameCompositionRequest {
  /** Decoded source frame for this output frame. */
  readonly frame: DecodedVideoFrame;
  /**
   * Every caption layer with something to paint at this frame, in paint
   * order (see `CaptionLayer.inPaintOrder`). Empty when no Section is
   * active.
   */
  readonly captions: ReadonlyArray<CaptionLayerFrame>;
  /** Frame-invariant decoration. `null` when no overlay was supplied. */
  readonly overlay: OverlayFrame | null;
  /**
   * Per-timestamp top layer painted between the caption layers under it
   * and those over it — used by effects that must occlude captions (e.g.
   * text-behind-actor). `null` when no top layer applies to this frame.
   */
  readonly topLayer: OverlayFrame | null;
  /** `false` composites every caption layer plainly, ignoring its blend mode: with no video beneath, a blend has nothing to mix with. */
  readonly blendCaptions: boolean;
  /** Width in pixels of the composition target. */
  readonly width: number;
  /** Height in pixels of the composition target. */
  readonly height: number;
}

/**
 * Composes one output frame into the given 2D context. The composition
 * recipe (which layer goes where, how to clear, how to scale) lives
 * here; the orchestrator and the encoder stay out of pixel work.
 */
export interface FrameCompositor {
  compose(
    target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FrameCompositionRequest,
  ): void;
}
