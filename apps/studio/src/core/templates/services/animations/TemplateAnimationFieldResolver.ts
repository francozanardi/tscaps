import { AnimationFieldCatalog } from '@core/elements/domain/AnimationFieldCatalog';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import type { TunedPropertyValues } from '@core/sheets/domain/SheetAnimation';

/** A dial a template offers, and what the property under it holds right now. */
export interface TemplateAnimationField {
  readonly control: ElementControl;
  readonly standing: AnimationValue;
}

/**
 * The dials a template offers over its own movement, for one kind of
 * element under it.
 *
 * A template's animation is not something the user picked, so there is
 * no record of it to read — what it is, what it was applied to, and
 * what it was given all come from what the stylesheet declared while
 * compiling. Each field starts on the value the template wrote, so
 * opening the panel shows the caption as it is rather than a set of
 * zeroes.
 *
 * **Only the animations declared on this kind of element.** A tuned
 * value is a declaration on the scope's own elements, and an element's
 * own declaration beats one it inherits whatever layer that came from
 * — so a dial over an animation living further in would move nothing.
 * A template that fades its captions and floats their words answers
 * two scopes, one each, however the two are clocked.
 *
 * A field with nothing to start on is left out. That covers a value
 * the template said two ways, and one with no number under it because
 * the template routed it through a variable of its own: the animation
 * runs either way, and only the dial cannot open.
 *
 * **Only at the entrance.** What a template does to a kind is shown as
 * one motion, at the end where the template's movement has always been
 * read, so its dials sit there too; an exit offers the dials of an exit
 * picked for it and nothing of the template's.
 */
export class TemplateAnimationFieldResolver {
  constructor(
    private readonly fieldCatalog: AnimationFieldCatalog,
    private readonly valueParser: ElementControlValueParser,
  ) {}

  fieldsFor(
    applied: ReadonlyArray<DeclaredAnimation>,
    scope: ElementAnimationScope,
    tuned: TunedPropertyValues = {},
  ): readonly TemplateAnimationField[] {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null || ANIMATION_PHASE_BY_SCOPE[scope] !== 'entrance') return [];
    const fields: TemplateAnimationField[] = [];
    const taken = new Set<string>();
    for (const animation of applied) {
      if (animation.element !== kind || (animation.end ?? 'entrance') !== 'entrance') continue;
      this.collectInto(fields, taken, animation, tuned);
    }
    return fields;
  }

  /**
   * One property answered by two animations is one dial: an element
   * ends up with a single value for it however many animations read
   * it. The halves of a split value are not the same dial, so a
   * direction and a distance over one property both survive.
   */
  private collectInto(
    fields: TemplateAnimationField[],
    taken: Set<string>,
    animation: DeclaredAnimation,
    tuned: TunedPropertyValues,
  ): void {
    for (const field of this.fieldCatalog.fieldsOf(animation.id)) {
      const seat = `${field.property} ${field.part}`;
      if (taken.has(seat)) continue;
      const standing = tuned[field.property] ?? animation.values[field.property];
      if (standing === undefined) continue;
      const held = this.valueParser.parse(field, standing);
      if (held === null) continue;
      taken.add(seat);
      fields.push({ control: { ...field, defaultValue: held }, standing });
    }
  }
}
