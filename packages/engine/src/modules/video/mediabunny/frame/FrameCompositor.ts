import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { SubtitleFrame } from '@modules/rendering/SubtitleFrameRenderer';
import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';

/**
 * The inputs the compositor needs to produce one output frame: the
 * decoded source frame, the per-timestamp caption layer, the
 * frame-invariant overlay, and the target dimensions. Layer order is
 * the compositor's call, not the request's.
 */
export interface FrameCompositionRequest {
  /** Decoded source frame for this output frame. */
  readonly frame: DecodedVideoFrame;
  /** Per-timestamp caption layer. `null` when no Section is active. */
  readonly captions: SubtitleFrame | null;
  /** Frame-invariant decoration. `null` when no overlay was supplied. */
  readonly overlay: OverlayFrame | null;
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
