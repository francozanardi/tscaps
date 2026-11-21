import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';

/** A layer active at a moment, and how it is drawn there. */
export interface ResolvedFootageLayer {
  readonly layer: FootageLayer;
  readonly state: FootageLayerFrameState;
}

/**
 * Answers how each of one set of footage layers is drawn at a moment of
 * the output, as its stylesheet resolves there. Bound to the layers and
 * the stylesheet it was opened with: a change to either is a new
 * resolver.
 *
 * Answers synchronously, so a picture composed every animation frame
 * can ask as it draws, and anything else showing the same moment can
 * ask the same instance and share the answer.
 */
export interface FootageLayerResolver {
  /**
   * Every layer active at `outputSec` of the output timeline, bottom to
   * top, with its state there. Asking again for the same moment answers
   * the same array without resolving anything; any other moment is
   * resolved afresh. Two times closer than a tenth of a millisecond, far
   * under a frame, may be taken as one moment. After {@link dispose},
   * answers nothing.
   */
  resolveAt(outputSec: number): ReadonlyArray<ResolvedFootageLayer>;

  /** Lets go of whatever the resolving holds, such as a stage in the document. Final. */
  dispose(): void;
}
