import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontStackFaces } from '@core/fonts/domain/FontStackCatalog';
import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';

/**
 * Reads a font that was written down as a single family name and gives
 * back the stack that family leads.
 *
 * The stack's other faces are the ones the old family-plus-fallback
 * resolution reached for anyway, so what was stored keeps painting
 * exactly what it painted.
 */
export class StoredFontStackReader {

  constructor(private readonly fontStackLibrary: FontStackLibrary) {}

  /** Typography with its one family opened into a stack, or untouched when it already holds one. */
  readTypography(typography: Record<string, unknown>): Record<string, unknown> {
    const { fontFamily, ...rest } = typography;
    if (typeof fontFamily !== 'string') return typography;
    return { ...rest, fontStack: this.facesLedBy(fontFamily) };
  }

  /**
   * Style-control values with every `font` control opened into a stack.
   *
   * Which controls hold a font is asked of the fields, never of the
   * control ids: an id is the template author's to choose, so a rule
   * keyed on one would work for the templates that happen to name
   * theirs a certain way and silently skip the rest.
   *
   * A value that does not hold for its field is left out, so the field
   * falls back to what it ships with rather than reaching a panel that
   * would have to describe it.
   */
  readStyleValues(
    fields: readonly ControlField[],
    stored: Readonly<Record<string, ControlValue>>,
  ): Record<string, ControlValue> {
    const read: Record<string, ControlValue> = { ...stored };
    for (const field of fields) {
      if (field.type !== 'font') continue;
      const held = stored[field.id];
      if (held === undefined) continue;
      if (FontStack.fromStoredFaces(held) !== null) continue;
      if (typeof held === 'string') read[field.id] = this.facesLedBy(held);
      else delete read[field.id];
    }
    return read;
  }

  facesLedBy(family: string): FontStackFaces {
    return this.fontStackLibrary.stackLedBy(family).toSnapshot();
  }
}
