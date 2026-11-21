import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';

/**
 * What a field holds: a line of text, a CSS colour, a number, an
 * image — a small picture held in the project as a `data:` URL, or the
 * empty string for none — or an emoji, one glyph as text, picked from
 * the emoji picker, or the empty string for none.
 */
export type GraphicFieldKind = 'text' | 'color' | 'number' | 'image' | 'emoji';

/**
 * One value a graphic's document reads from `tscaps.params[id]`, offered
 * to the user as a control labelled `label`, holding `defaultValue`
 * until it is set.
 */
export interface GraphicField {
  readonly id: string;
  readonly label: string;
  readonly kind: GraphicFieldKind;
  readonly defaultValue: GraphicParamValue;
}
