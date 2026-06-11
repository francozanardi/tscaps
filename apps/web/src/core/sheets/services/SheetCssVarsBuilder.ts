import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import type { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import type { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';

/**
 * Combines every `--tscaps-*` custom property a sheet contributes to its
 * overlay / line-splitter / exporter wrapper: typography vars, rotation
 * vars, and the template-specific style values. Style values come last
 * so a template can override a typography or rotation key from its own
 * `styleControls` if it ever needs to.
 *
 * All dependencies are constructor-injected — callers pass only the
 * sheet they want rendered. The user-blob URL resolver image fields
 * need is baked into the injected `StyleValuesCssVarsBuilder`.
 */
export class SheetCssVarsBuilder {
  constructor(
    private readonly typographyCssVarBuilder: TypographyCssVarBuilder,
    private readonly rotationCssVarBuilder: RotationCssVarBuilder,
    private readonly styleValuesCssVarsBuilder: StyleValuesCssVarsBuilder,
  ) {}

  build(sheet: Sheet): Record<string, string> {
    return {
      ...this.typographyCssVarBuilder.build(sheet.typographyConfig),
      ...this.rotationCssVarBuilder.build(sheet.rotationConfig),
      ...this.styleValuesCssVarsBuilder.build(sheet.styleValues),
    };
  }
}
