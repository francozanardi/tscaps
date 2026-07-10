import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Emits the `--tscaps-<id>` CSS variables that template `style.css` files
 * read via `var(--tscaps-font-family, ...)` etc.
 *
 * `font-family` is always quoted because some bundled families
 * (e.g. "Press Start 2P") start with a digit and break unquoted in CSS.
 *
 * `font-weight` and `font-style` are always emitted: variable fonts make
 * the full weight axis meaningful (the user picks any 100..900) and some
 * templates are italic-by-default (Elegant, High) so the "italic off"
 * toggle has to be able to disable italic. `text-decoration` is only
 * emitted when at least one of underline/strikethrough is on — templates
 * have no decoration-by-default.
 */
export class TypographyCssVarBuilder {
  build(config: TypographyConfig): Record<string, string> {
    const vars: Record<string, string> = {
      [TemplateCssVariable.FONT_FAMILY]: `'${config.fontFamily}'`,
      [TemplateCssVariable.FONT_SIZE]: `${config.fontSize}cqh`,
      [TemplateCssVariable.FONT_WEIGHT]: String(config.fontWeight),
      [TemplateCssVariable.LETTER_SPACING]: `${config.letterSpacing}em`,
      [TemplateCssVariable.WORD_SPACING]: `${config.wordSpacing}em`,
      [TemplateCssVariable.LINE_SPACING]: `${config.lineSpacing}em`,
      [TemplateCssVariable.TEXT_TRANSFORM]: config.textCase,
      [TemplateCssVariable.TEXT_ALIGN]: config.textAlign,
      [TemplateCssVariable.FONT_STYLE]: config.italic ? 'italic' : 'normal',
    };
    const decorations: string[] = [];
    if (config.underline) decorations.push('underline');
    if (config.strikethrough) decorations.push('line-through');
    if (decorations.length > 0) vars[TemplateCssVariable.TEXT_DECORATION] = decorations.join(' ');
    return vars;
  }
}
