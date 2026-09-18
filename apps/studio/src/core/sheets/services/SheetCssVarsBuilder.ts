import type { FontStackCssVarsBuilder } from '@core/fonts/services/FontStackCssVarsBuilder';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import type { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import type { TextDirectionCssVarBuilder } from '@core/sheets/services/TextDirectionCssVarBuilder';
import type { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';
import type { EmojiCssVarBuilder } from '@core/effect/services/EmojiCssVarBuilder';

/**
 * Combines every `--tscaps-*` custom property a sheet contributes to its
 * overlay / line-splitter / exporter wrapper: typography vars, rotation
 * vars, template-specific style values, and emoji decoration vars.
 * Style values come last so a template can override a typography or
 * rotation key from its own `styleControls` if it ever needs to.
 *
 * All dependencies are constructor-injected — callers pass only the
 * sheet they want rendered. The user-blob URL resolver image fields
 * need is baked into the injected `StyleValuesCssVarsBuilder`.
 */
export class SheetCssVarsBuilder {
  constructor(
    private readonly typographyCssVarBuilder: TypographyCssVarBuilder,
    private readonly textDirectionCssVarBuilder: TextDirectionCssVarBuilder,
    private readonly rotationCssVarBuilder: RotationCssVarBuilder,
    private readonly styleValuesCssVarsBuilder: StyleValuesCssVarsBuilder,
    private readonly emojiCssVarBuilder: EmojiCssVarBuilder,
    private readonly fontStackCssVarsBuilder: FontStackCssVarsBuilder,
  ) {}

  build(sheet: Sheet): Record<string, string> {
    return {
      ...this.fontStackCssVarsBuilder.build(sheet.template.fontStackIds, sheet.scripts),
      ...this.typographyCssVarBuilder.build(sheet.typographyConfig, sheet.textDirection, sheet.scripts),
      ...this.textDirectionCssVarBuilder.build(sheet.textDirection),
      ...this.rotationCssVarBuilder.build(sheet.rotationConfig),
      ...this.styleValuesCssVarsBuilder.build(sheet.styleValues, sheet.scripts),
      ...this.emojiCssVarBuilder.build(sheet.effectConfig('emoji')),
    };
  }
}
