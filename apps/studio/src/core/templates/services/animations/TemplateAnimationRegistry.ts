import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import { ANIMATED_NODE_KINDS, type AnimatedNodeKind } from '@core/elements/domain/AnimatedNodeKind';
import type { DeclaredAnimation, DeclaredAnimationEnd } from '@core/templates/domain/definition/DeclaredAnimation';
import { AgreedAnimationValues } from '@core/templates/services/animations/AgreedAnimationValues';

/**
 * Collects the library animations one template applies while its
 * stylesheet is compiled, and the value it gives each of their fields.
 * An animation primitive declares itself here, so how a template moves
 * reaches the template without it having to say so a second time.
 *
 * Applying the same animation twice to one kind of element is one
 * answer stated twice and collapses into one entry, keeping whatever
 * the two agreed on. The same animation on two kinds does not: a
 * caption that rises and whose words rise after it is two answers, and
 * they are declared on two different elements.
 *
 * One instance covers one template: it accumulates and never resets.
 */
export class TemplateAnimationRegistry {
  private readonly appliedByKey = new Map<string, AppliedAnimation>();

  /**
   * Records `id` as applied to the elements of `element` at `end` of
   * their life, giving its properties `values`.
   *
   * A kind or an end outside the vocabulary is refused rather than
   * recorded: it would name an element no dial could ever be written
   * for, or an end no tab shows, and a typo is the likeliest way to get
   * one. So is one animation on one kind played at both ends, which no
   * tab could show as one answer.
   */
  declare(
    id: string,
    element: string,
    values: ReadonlyMap<string, AnimationValue>,
    keyframes: readonly string[],
    end: string,
  ): void {
    const kind = this.kindNamed(id, element);
    const at = this.endNamed(id, end);
    const key = `${id}@${kind}`;
    const applied = this.appliedByKey.get(key)
      ?? { id, element: kind, end: at, values: new AgreedAnimationValues(), keyframes: new Set<string>() };
    if (applied.end !== at) {
      throw new Error(`Animation "${id}" is declared on "${kind}" both as an entrance and as an exit. Give each end its own id.`);
    }
    applied.values.add(values);
    for (const name of keyframes) applied.keyframes.add(name);
    this.appliedByKey.set(key, applied);
  }

  declared(): readonly DeclaredAnimation[] {
    return [...this.appliedByKey.values()].map(({ id, element, end, values, keyframes }) => ({
      id,
      element,
      values: values.agreed(),
      keyframes: [...keyframes],
      // An entrance is what an animation with no end has always meant,
      // so only an exit is written down.
      ...(end === 'exit' ? { end } : {}),
    }));
  }

  /** Every `@keyframes` block the animations declared here are made of. */
  keyframeNames(): ReadonlySet<string> {
    const names = new Set<string>();
    for (const applied of this.appliedByKey.values()) {
      for (const name of applied.keyframes) names.add(name);
    }
    return names;
  }

  private endNamed(id: string, end: string): DeclaredAnimationEnd {
    if (end === 'entrance' || end === 'exit') return end;
    throw new Error(`Animation "${id}" was declared at "${end}", which is not an end. Name entrance or exit.`);
  }

  private kindNamed(id: string, element: string): AnimatedNodeKind {
    const found = ANIMATED_NODE_KINDS.find((known) => known === element);
    if (found === undefined) {
      throw new Error(
        `Animation "${id}" was declared on "${element}", which is not an element. `
        + `Name one of: ${ANIMATED_NODE_KINDS.join(', ')}.`,
      );
    }
    return found;
  }
}

/** One animation on one kind of element, while its call sites are still being collected. */
interface AppliedAnimation {
  readonly id: string;
  readonly element: AnimatedNodeKind;
  readonly end: DeclaredAnimationEnd;
  readonly values: AgreedAnimationValues;
  readonly keyframes: Set<string>;
}
