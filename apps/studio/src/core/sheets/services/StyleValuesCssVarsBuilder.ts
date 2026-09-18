import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import { ControlCssVariable } from '@core/templates/domain/definition/ControlCssVariable';
import type { StyleValues } from '@core/sheets/domain/StyleValues';
import type { AssetRepository } from '@core/assets/domain/AssetRepository';
import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { ControlValueCssRenderer } from '@core/templates/services/controls/ControlValueCssRenderer';

/**
 * Builds the `--tscaps-{id}` CSS custom-property map for a `StyleValues`
 * snapshot. Every field renders through `ControlValueCssRenderer`
 * except images, which need the asset repository to resolve a stored
 * id to a URL: an id that resolves emits `url("<resolved>")`, and one
 * that does not leaves the property unset so the template's own
 * `var(--tscaps-{id}, url('asset:<name>'))` fallback still paints.
 */
export class StyleValuesCssVarsBuilder {
  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly controlValueCssRenderer: ControlValueCssRenderer,
  ) {}

  /**
   * `scripts` are the alphabets the captions these values style are
   * written in, which decide how a `font` control's stack compiles.
   * `null` where there are no captions to read them off.
   */
  build(styleValues: StyleValues, scripts: CaptionScripts | null): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const [field, value] of styleValues.entries()) {
      const rendered = this.renderField(field, value, scripts);
      if (rendered === null) continue;
      vars[ControlCssVariable.nameFor(field.id)] = rendered;
    }
    return vars;
  }

  private renderField(field: ControlField, value: ControlValue, scripts: CaptionScripts | null): string | null {
    if (field.type === 'image') return this.renderImage(value);
    return this.controlValueCssRenderer.render(field, value, scripts);
  }

  private renderImage(value: ControlValue): string | null {
    if (typeof value !== 'string') return null;
    const asset = this.assetRepository.resolve(value);
    if (asset === null) return null;
    return `url("${asset.url}")`;
  }
}
