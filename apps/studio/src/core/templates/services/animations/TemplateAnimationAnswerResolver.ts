import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';

/**
 * What a template already does to one kind of element at one end of its
 * life, in the terms the picker speaks.
 *
 * `named` is one of its cards. `still` is nothing moving that kind at
 * that end, which the picker calls "None" — the same thing a sheet
 * would be asking for by picking it. `unnamed` is movement the picker
 * has no card for: something bespoke, something the library keeps out
 * of the list, or two animations at once.
 */
export type TemplateAnimationAnswer =
  | { readonly kind: 'named'; readonly presetId: string }
  | { readonly kind: 'still' }
  | { readonly kind: 'unnamed' };

/**
 * Which card in the picker a template's own movement already is.
 *
 * A sheet has nothing above it to defer to, so "as the template has
 * it" is a fact this can look up rather than a deferral, and naming
 * the movement beats naming where it came from. The template's own
 * card is then only for the movement the picker cannot name.
 *
 * **Every animation a template applies is declared**, its own keyframes
 * as much as the library's — which is what makes `still` mean nothing
 * moves rather than nothing was recorded. A template that animates
 * without declaring it reads here as still, and the caption would then
 * move under a panel saying it does not.
 *
 * **An animation is filed under the end the template declared it at.**
 * That is the entrance unless the template says exit, which is where a
 * template's movement has always been shown; an exit the template plays
 * is its answer in the Exit tab, and a template without one leaves the
 * kind still there. Among the library's, the card is the one compiled
 * for the clock of that end.
 *
 * Two animations at one end are `unnamed`: the template's answer is not
 * one card, and picking either would claim the other is not running.
 */
export class TemplateAnimationAnswerResolver {
  constructor(
    private readonly animationCatalog: ElementAnimationCatalog,
    private readonly timingVariableResolver: ElementTimingVariableResolver,
  ) {}

  answerFor(
    applied: ReadonlyArray<DeclaredAnimation>,
    scope: ElementAnimationScope,
  ): TemplateAnimationAnswer {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null) return { kind: 'unnamed' };
    const end = ANIMATION_PHASE_BY_SCOPE[scope];
    const onKind = applied.filter((animation) => animation.element === kind && (animation.end ?? 'entrance') === end);
    const bespoke = onKind.some((animation) => this.animationCatalog.byId(animation.id) === null);
    if (bespoke) return { kind: 'unnamed' };
    const offered = this.animationCatalog.forClock(kind, this.timingVariableResolver.resolve(kind, scope));
    const atThisEnd = onKind.filter((animation) => offered.some((preset) => preset.id === animation.id));
    if (atThisEnd.length === 0) return { kind: 'still' };
    if (atThisEnd.length > 1) return { kind: 'unnamed' };
    return { kind: 'named', presetId: atThisEnd[0]!.id };
  }
}
