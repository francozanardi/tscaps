import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';

/**
 * Opens an animated image for reading frame by frame, moments being
 * seconds of its own timeline from its first frame; it starts over each
 * time it runs out.
 *
 * Rejects with an `AnimatedImageOpenFailedError` where it cannot play
 * the animation — the browser lacks what it needs, or the file will not
 * decode as one — rather than standing a still in for it.
 */
export interface AnimatedImageOpener {
  open(blob: Blob): Promise<DrawableFootage>;
}
