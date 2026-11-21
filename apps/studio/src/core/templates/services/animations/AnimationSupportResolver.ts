import { ANIMATED_KIND_BY_SCOPE, type ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { AnimationSupport } from '@core/templates/domain/definition/FeaturesConfig';

/**
 * Whether a template's look survives being animated where a panel is
 * about to offer it.
 *
 * An answer lands on one kind of element however it was reached — a
 * sheet answering for every caption and one caption answering for
 * itself both write onto a segment — so support is asked of the kind
 * rather than of the panel. `owner` is the element whose panel this is,
 * which is what a scope meaning "the element itself" lands on, and is
 * `null` for a sheet, which is not an element. A layer is not a caption
 * node and no template paints it, so nothing a template says stops it.
 */
export class AnimationSupportResolver {
  supports(support: AnimationSupport, scope: ElementAnimationScope, owner: ElementKind | null): boolean {
    const landsOn = ANIMATED_KIND_BY_SCOPE[scope] ?? owner;
    return landsOn === null || landsOn === 'layer' ? true : support[landsOn];
  }
}
