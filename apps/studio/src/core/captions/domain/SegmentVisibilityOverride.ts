/**
 * What the user chose for whether one scene is painted, outranking the
 * brief-scene rule:
 *  - `auto`: the rule decides — hidden when brief scenes are hidden and
 *    the scene is on screen too briefly to read.
 *  - `hidden`: never painted.
 *  - `shown`: always painted, however brief.
 */
export type SegmentVisibilityOverride = 'auto' | 'hidden' | 'shown';
