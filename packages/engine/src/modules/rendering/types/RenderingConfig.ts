import type { BoxEdges } from '@modules/rendering/types/BoxEdges';

/**
 * Whether a style consumes the underlying video frame as part of
 * its visuals, and — when it does — at what JPEG quality the frame
 * should be encoded for embedding.
 */
export interface VideoFrameRequirement {
  readonly required: boolean;
  /** JPEG quality in `[0, 1]`; consulted only when `required` is true. */
  readonly jpegQuality: number;
}

/**
 * Structural switches the renderer consults while painting a Section.
 * Affect the shape of the emitted DOM, not just its visual styling.
 */
export interface RenderingConfig {
  readonly splitWordsIntoLetters: boolean;
  readonly videoFrame: VideoFrameRequirement;
  /** Extra space around the segment box, per side. `null` when not declared. */
  readonly padding: BoxEdges | null;
}
