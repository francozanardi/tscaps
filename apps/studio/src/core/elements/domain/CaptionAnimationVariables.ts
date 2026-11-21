import type { CaptionElementKind } from '@core/elements/domain/ElementKind';

/** The two custom properties one kind of caption node publishes its motion in, one per end. */
export interface CaptionAnimationVariables {
  /** Holds the `animation` shorthand of how it comes in. */
  readonly entrance: string;
  /** Holds the `animation` shorthand of how it leaves. */
  readonly exit: string;
}

/**
 * Where each kind of caption node keeps the two halves of its motion.
 *
 * An element plays both ends through one `animation`, and each end can
 * be answered at a different level — a sheet telling every word how it
 * arrives, one word told how it leaves. Neither answer may write
 * `animation` whole, or the later one would erase the other, so each
 * publishes its half here and the same declaration plays both:
 * `animation: var(<entrance>, none), var(<exit>, none)`.
 *
 * One pair per kind rather than one for every node. A custom property
 * is inherited, so a caption's own entrance would otherwise reach each
 * of its words, which would then play it on the caption's clock. A name
 * of its own per kind means a node only ever reads what was published
 * for nodes like it.
 *
 * Each name ends in `-animation`, which is what the keyframe renaming
 * and the stylesheet scans read as a shorthand to follow — the same
 * convention a shot layer's `--layer-entrance-animation` keeps.
 */
export const CAPTION_ANIMATION_VARIABLES: Readonly<Record<CaptionElementKind, CaptionAnimationVariables>> = {
  segment: { entrance: '--segment-entrance-animation', exit: '--segment-exit-animation' },
  line: { entrance: '--line-entrance-animation', exit: '--line-exit-animation' },
  word: { entrance: '--word-entrance-animation', exit: '--word-exit-animation' },
  decoration: { entrance: '--decoration-entrance-animation', exit: '--decoration-exit-animation' },
};
