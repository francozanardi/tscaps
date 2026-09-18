import type { HorizontalSideResolver, TextDirection } from '@tscaps/engine';
import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Emits the `--tscaps-<id>` CSS variables that template `style.css` files
 * read via `var(--tscaps-font-family, ...)` etc.
 *
 * `font-family` is emitted as the family the sheet's stack compiles to,
 * which carries a face for every alphabet the captions hold and one set
 * of vertical metrics for all of them.
 *
 * `font-weight` and `font-style` are always emitted: variable fonts make
 * the full weight axis meaningful (the user picks any 100..900) and some
 * templates are italic-by-default (Elegant, High) so the "italic off"
 * toggle has to be able to disable italic. `text-decoration` is only
 * emitted when at least one of underline/strikethrough is on — templates
 * have no decoration-by-default.
 *
 * `text-align` is stored relative to the reading direction, so the caller
 * supplies the direction the sheet reads in and the emitted value is the
 * physical side it lands on.
 */
export class TypographyCssVarBuilder {

  constructor(
    private readonly horizontalSideResolver: HorizontalSideResolver,
    private readonly fontStackResolver: FontStackResolver,
  ) {}

  build(
    config: TypographyConfig,
    textDirection: TextDirection,
    scripts: CaptionScripts | null,
  ): Record<string, string> {
    const vars: Record<string, string> = {
      [TemplateCssVariable.FONT_FAMILY]: this.fontStackResolver.resolve(config.fontStack, scripts),
      [TemplateCssVariable.FONT_SIZE]: `${config.fontSize}cqh`,
      [TemplateCssVariable.FONT_WEIGHT]: String(config.fontWeight),
      [TemplateCssVariable.LETTER_SPACING]: `${config.letterSpacing}em`,
      [TemplateCssVariable.WORD_SPACING]: `${config.wordSpacing}em`,
      [TemplateCssVariable.LINE_SPACING]: `${config.lineSpacing}em`,
      [TemplateCssVariable.TEXT_TRANSFORM]: config.textCase,
      [TemplateCssVariable.TEXT_ALIGN]: this.horizontalSideResolver.toPhysical(config.textAlign, textDirection),
      [TemplateCssVariable.FONT_STYLE]: config.italic ? 'italic' : 'normal',
    };
    const decorations: string[] = [];
    if (config.underline) decorations.push('underline');
    if (config.strikethrough) decorations.push('line-through');
    if (decorations.length > 0) vars[TemplateCssVariable.TEXT_DECORATION] = decorations.join(' ');
    return vars;
  }
}
