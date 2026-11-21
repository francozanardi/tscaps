import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * Which part of a declaration's value a control drives.
 *
 * `whole` is the value itself. `sign` and `magnitude` split one signed
 * value between two controls — a direction to pick and a distance to
 * drag — because the property carries both and neither reads well on
 * its own: a slider crossing zero hides a direction change in its
 * middle, and a distance with no sign cannot say which way.
 *
 * `keyword` owns one token of a space-separated value, for a property
 * that answers two questions at once: `text-decoration-line` carries
 * underline and strikethrough together, and CSS has no longhand for
 * either alone. The control's second option is the token it owns; the
 * first is what the property says once no token is left.
 */
export type ElementValuePart = 'whole' | 'sign' | 'magnitude' | 'keyword';

/** One choice offered by a control that picks rather than drags. */
export interface ElementControlOption {
  readonly value: string;
  readonly label: string;
}

/**
 * One field the editor offers for an element, and the declaration in
 * that element's own CSS that it reads and writes.
 *
 * What the field holds is recorded; the declaration is generated from
 * it. Nothing reads the declaration back, so `property` naming one the
 * generated CSS does not declare produces a field that moves nothing —
 * which is why the build refuses it rather than leaving it to be
 * noticed on screen.
 */
export interface AuthoredElementControl {
  readonly id: string;
  readonly label: string;
  readonly property: string;
  readonly part: ElementValuePart;
  /**
   * How the field is presented, and how its value is spelled in CSS.
   * A `number` carries a unit and arithmetic; the rest are written to
   * the declaration as they stand. A `toggle` is a `select` of two
   * options drawn as a pressed or unpressed button.
   */
  readonly type: 'number' | 'select' | 'toggle' | 'color' | 'font';
  /** Appended to the number a `number` control writes, when the value carries one. */
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Required for `select`, `toggle` and `keyword`. A `sign` control's values are `positive` and `negative`. */
  readonly options?: ReadonlyArray<ElementControlOption>;
  /** Shown below the field, for a label that cannot carry the whole meaning on its own. */
  readonly legend?: string;
  /**
   * How a `number` reads where it is shown, when not as written:
   * `percent` shows a fraction as a percentage, `0.5` as `50%`. What is
   * recorded and written to CSS is the number itself.
   */
  readonly readAs?: 'percent';
}

/**
 * An authored control once the build has read what its entrance ships
 * the field at.
 *
 * The default is not optional: a field with nothing recorded against it
 * yet has to show the value the element is actually entering with, and
 * one that cannot say so shows a zero the user never chose.
 */
export interface ElementControl extends AuthoredElementControl {
  readonly defaultValue: ElementControlValue;
}
