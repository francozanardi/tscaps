import { SassNumber, SassString, type Value } from 'sass';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { TemplateAnimationRegistry } from '@core/templates/services/animations/TemplateAnimationRegistry';

/**
 * Reads one value a primitive gave a property of its own.
 *
 * A number crosses as an amount and a unit rather than as the text it
 * would print as, so a field over it never has to read a length back
 * out of a string. Everything else — a `var()` a template routes its
 * timing through, a colour — crosses whole, and says by its shape that
 * there is no number under it.
 */
function toAnimationValue(value: Value): AnimationValue {
  if (value instanceof SassNumber) {
    return { kind: 'number', amount: value.value, unit: value.numeratorUnits.get(0) ?? '' };
  }
  return { kind: 'text', text: value.toString() };
}

/**
 * The `tscaps-declared-animation($id, $element, $values, $keyframes, $end)`
 * implementation behind `_lib/animation/declared.scss`. The record is
 * the whole of it — the return value exists because Sass has no
 * statement form for a call, and nothing reads it.
 */
export function declaredAnimationFunction(registry: TemplateAnimationRegistry) {
  return (args: Value[]): Value => {
    const values = new Map<string, AnimationValue>();
    for (const [property, value] of args[2]!.assertMap().contents) {
      values.set(property.assertString().text, toAnimationValue(value));
    }
    const keyframes = args[3]!.asList.toArray().map((name) => name.assertString().text);
    registry.declare(args[0]!.assertString().text, args[1]!.assertString().text, values, keyframes, args[4]!.assertString().text);
    return new SassString('', { quotes: false });
  };
}
