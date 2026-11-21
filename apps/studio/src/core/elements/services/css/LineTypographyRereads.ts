import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * For each field a line wrote through a template variable, the
 * declaration a template derives from that variable.
 *
 * A line wraps its words, so its fields write the template's variables
 * rather than the properties themselves. Templates read those variables
 * on the whole caption (`segment-typography` turns `--tscaps-font-weight`
 * into `font-weight` on `.segment`), and the words inherit the result
 * computed there: a variable a line sets afterwards reaches only the word
 * rules that read it themselves. Declaring the property again on the line,
 * from the same variable, is what makes the words inherit the line's
 * value; the template's own rules on a word (a tag's weight, a state's
 * colour) still win over it, as they do over the caption's.
 *
 * The expressions mirror the template library's caption typography, so a
 * field reads on a line as it reads on the caption around it.
 */
const DECLARATION_BY_FIELD: ReadonlyMap<string, string> = new Map([
  [ElementFieldId.FONT_FAMILY, `font-family: var(${TemplateCssVariable.FONT_FAMILY});`],
  [ElementFieldId.FONT_SIZE, `font-size: calc(var(${TemplateCssVariable.FONT_SIZE}) * var(${TemplateCssVariable.FONT_SIZE_SCALE}, 1));`],
  [ElementFieldId.FONT_WEIGHT, `font-weight: var(${TemplateCssVariable.FONT_WEIGHT});`],
  [ElementFieldId.ITALIC, `font-style: var(${TemplateCssVariable.FONT_STYLE});`],
  [ElementFieldId.PRIMARY_COLOR, `color: var(${TemplateCssVariable.PRIMARY_COLOR});`],
  [ElementFieldId.ROTATION, `rotate: var(${TemplateCssVariable.ROTATION});`],
]);

/** The declarations a line's own rule adds so that what its fields hold reaches its words. */
export class LineTypographyRereads {
  /**
   * The declarations for each field `style` holds a value for, one per
   * line, ahead of anything the element wrote itself so that its own
   * hand-written declarations still win. Empty for any element that is
   * not a line, or a line whose fields hold nothing.
   */
  declarationsFor(style: ElementStyle): string {
    if (style.kind !== 'line' || style.fields === undefined) return '';
    return Object.keys(style.fields)
      .map((fieldId) => DECLARATION_BY_FIELD.get(fieldId))
      .filter((declaration): declaration is string => declaration !== undefined)
      .join('\n');
  }
}
