import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  type ElementAnimationPhase,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { CaptionElementKind } from '@core/elements/domain/ElementKind';

/** What moves in one of a motion panel's answers: the element itself, or every part of a kind inside it. */
export type MotionPart = CaptionElementKind | 'self';

/**
 * The scopes something offers, laid out the way a motion panel reads
 * them: which ends of its life it moves at, which parts of it move, and
 * the scope that answers one part at one end.
 *
 * Both axes keep the order the scopes were offered in, so the kind that
 * declares them is what decides how the panel reads.
 */
export class MotionScopeLayout {
  constructor(private readonly scopes: ReadonlyArray<ElementAnimationScope>) {}

  /** The ends anything here moves at: as it comes in, as it leaves. */
  ends(): ReadonlyArray<ElementAnimationPhase> {
    return this.distinct(this.scopes.map((scope) => ANIMATION_PHASE_BY_SCOPE[scope]));
  }

  /** The parts that move, the element itself first where it is one of them. */
  parts(): ReadonlyArray<MotionPart> {
    return this.distinct(this.scopes.map((scope) => this.partOf(scope)));
  }

  /** The scope answering `part` at `end`, or null where that part does not move at that end. */
  scopeAt(part: MotionPart, end: ElementAnimationPhase): ElementAnimationScope | null {
    return this.scopes.find((scope) => this.partOf(scope) === part && ANIMATION_PHASE_BY_SCOPE[scope] === end) ?? null;
  }

  private partOf(scope: ElementAnimationScope): MotionPart {
    return ANIMATED_KIND_BY_SCOPE[scope] ?? 'self';
  }

  private distinct<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
    return [...new Set(values)];
  }
}
