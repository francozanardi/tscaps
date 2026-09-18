import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';

/**
 * Turns a style-control value into the CSS token its custom property
 * carries, following the field's type:
 *
 * - `toggle` picks `valueOn` / `valueOff`, so CSS reads the property
 *   directly (`font-style: var(--tscaps-italic)`).
 * - `select` emits the matched option's `cssValue`, falling back to the
 *   stored value when the option is gone.
 * - `text` emits a CSS `<string>` token, quoted and escaped, safe to
 *   substitute into `content: var(...)`.
 * - `font` emits the family its stack compiles to, so every alphabet the
 *   captions hold draws on the face the stack chose for it.
 * - a number with a declared unit emits `${value}${unit}`.
 *
 * `image` is not handled here: resolving an asset id to a URL needs a
 * repository, which makes it a different responsibility.
 */
export class ControlValueCssRenderer {
  constructor(private readonly fontStackResolver: FontStackResolver) {}

  render(field: ControlField, value: ControlValue, scripts: CaptionScripts | null): string {
    if (field.type === 'toggle') {
      return value ? (field.valueOn ?? '1') : (field.valueOff ?? '0');
    }
    if (field.type === 'select') {
      const match = field.options?.find((option) => option.value === value);
      return match?.cssValue ?? String(value);
    }
    if (field.type === 'text') {
      return this.asCssString(String(value));
    }
    if (field.type === 'font') {
      const stack = FontStack.fromStoredFaces(value);
      if (stack === null) return this.asCssString(String(value));
      return this.fontStackResolver.resolve(stack, scripts);
    }
    if (typeof value === 'number' && field.unit) {
      return `${value}${field.unit}`;
    }
    return String(value);
  }

  private asCssString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
}
