import type { Segment } from '@modules/document/Segment';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

/** Which implementation answers. `keyframe-scan` is the default; see `history/captions-rendering.md`. */
export type AnimationStateFingerprintStrategy = 'keyframe-scan' | 'subtree-mount' | 'none';

/**
 * Describes where a segment's animations stand at one timestamp.
 *
 * Two timestamps described by the same value hold every animation at
 * the same point, so the segment resolves to the same computed styles
 * at both. `null` is not a description: it says the state at that
 * timestamp cannot be compared with the state at any other.
 *
 * `classFingerprint` describes the classes the segment's elements
 * carry at `t`. Two timestamps given the same one match the same
 * rules.
 */
export interface AnimationStateFingerprint {
  at(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    segmentIndex: number,
    classFingerprint: string,
  ): Promise<string | null>;
}
