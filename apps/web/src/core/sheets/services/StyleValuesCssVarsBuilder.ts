import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { StyleValues } from '@core/sheets/domain/StyleValues';
import type { AssetRepository } from '@core/assets/domain/AssetRepository';

/**
 * Builds the `--tscaps-{id}` CSS custom-property map for a `StyleValues`
 * snapshot.
 *
 * - Toggle fields translate boolean → `field.valueOn` / `field.valueOff`
 *   so the CSS can use them directly (e.g. `--tscaps-italic: italic | normal`).
 * - Select fields emit the matched option's `cssValue`, falling back to
 *   the raw value if the option is missing.
 * - Text fields emit a CSS `<string>` token (double-quoted, with `\` and
 *   `"` escaped) safe to substitute into `content: var(...)`.
 * - Numeric fields with a declared `unit` emit `${value}${unit}`.
 * - Image fields render `url("<resolved>")` whenever the stored id
 *   resolves through the asset repository; unknown / deleted ids leave
 *   the var unset so the template's own `var(--tscaps-{id},
 *   url('asset:<name>'))` fallback can still paint a sensible value.
 */
export class StyleValuesCssVarsBuilder {
  constructor(private readonly assetRepository: AssetRepository) {}

  build(styleValues: StyleValues): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const [field, value] of styleValues.entries()) {
      const rendered = this.renderField(field, value);
      if (rendered === null) continue;
      vars[`--tscaps-${field.id}`] = rendered;
    }
    return vars;
  }

  private renderField(field: ControlField, value: ControlValue): string | null {
    if (field.type === 'image') return this.renderImage(value);
    return this.renderScalar(field, value);
  }

  private renderImage(value: ControlValue): string | null {
    if (typeof value !== 'string') return null;
    const asset = this.assetRepository.resolve(value);
    if (asset === null) return null;
    return `url("${asset.url}")`;
  }

  private renderScalar(field: ControlField, value: ControlValue): string {
    if (field.type === 'toggle') {
      const on = field.valueOn ?? '1';
      const off = field.valueOff ?? '0';
      return value ? on : off;
    }
    if (field.type === 'select') {
      const match = field.options?.find((o) => o.value === value);
      return match?.cssValue ?? String(value);
    }
    if (field.type === 'text') {
      return this.escapeCssString(String(value));
    }
    if (field.type === 'font') {
      return `'${String(value)}'`;
    }
    if (typeof value === 'number' && field.unit) {
      return `${value}${field.unit}`;
    }
    return String(value);
  }

  private escapeCssString(s: string): string {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
}
