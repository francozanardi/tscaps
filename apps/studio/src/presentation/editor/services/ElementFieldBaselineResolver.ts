import { DECORATION_FONT_SIZE_MULTIPLIER } from '@tscaps/engine';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementFieldValues, ElementStyle } from '@core/elements/domain/ElementStyles';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { Sheet } from '@core/sheets/domain/Sheet';

const WHOLE_RATIO = 100;

// Templates that never declare a colour control paint from their own
// stylesheet, and asking that stylesheet what colour it paints is the
// question this whole model exists to avoid. The picker opens on white
// rather than on an answer nobody can stand behind.
const UNKNOWN_COLOR = '#ffffff';

/**
 * What an element's fields show while the element has been told nothing.
 *
 * Two sources, and which one applies is the field's own answer. A field
 * whose value arrives from further out reads the nearest ancestor that
 * was given one; a field whose value is already folded into what the
 * element renders at starts from its own neutral instead.
 *
 * Everything here is answered from what was configured — the sheet's
 * typography, its control values, its rotation. Nothing is measured off
 * the screen and nothing is read out of a stylesheet, so the number a
 * field opens on is one the editor decided rather than one it found.
 */
export class ElementFieldBaselineResolver {
  constructor(private readonly catalog: StyledElementCatalog) {}

  /** Keyed by field id. `ancestors` runs nearest first. */
  resolve(
    kind: ElementKind,
    sheet: Sheet,
    ancestors: ReadonlyArray<ElementStyle | null>,
  ): ElementFieldValues {
    const baseline: Record<string, ElementControlValue> = {};
    for (const field of this.catalog.fieldsFor(kind)) {
      const handedDown = field.inheritsFromAncestor() ? this.heldByNearest(field.id, ancestors) : undefined;
      baseline[field.id] = handedDown ?? this.configured(field.id, kind, sheet);
    }
    return baseline;
  }

  private heldByNearest(fieldId: ElementFieldId, ancestors: ReadonlyArray<ElementStyle | null>): ElementControlValue | undefined {
    for (const ancestor of ancestors) {
      const held = ancestor?.fields?.[fieldId];
      if (held !== undefined) return held;
    }
    return undefined;
  }

  private configured(fieldId: ElementFieldId, kind: ElementKind, sheet: Sheet): ElementControlValue {
    const typography = sheet.typographyConfig;
    switch (fieldId) {
      case ElementFieldId.ITALIC: return typography.italic ? 'italic' : 'normal';
      case ElementFieldId.UNDERLINE: return typography.underline ? 'underline' : 'none';
      case ElementFieldId.STRIKETHROUGH: return typography.strikethrough ? 'line-through' : 'none';
      case ElementFieldId.FONT_FAMILY: return typography.fontStack.toSnapshot();
      case ElementFieldId.FONT_WEIGHT: return typography.fontWeight;
      case ElementFieldId.FONT_SIZE: return typography.fontSize;
      case ElementFieldId.RELATIVE_SIZE: return this.naturalRatio(kind, sheet);
      case ElementFieldId.PRIMARY_COLOR: return this.configuredColor(sheet);
      case ElementFieldId.ROTATION: return this.naturalAngle(kind, sheet);
    }
  }

  /** A glyph opens at the size the sheet already draws it, everything else at its parent's. */
  private naturalRatio(kind: ElementKind, sheet: Sheet): number {
    if (kind !== 'decoration') return WHOLE_RATIO;
    return (sheet.effectConfig('emoji')?.size ?? DECORATION_FONT_SIZE_MULTIPLIER) * WHOLE_RATIO;
  }

  /** A wrapper is turned as far as the sheet turns it; text inside adds to that rather than repeating it. */
  private naturalAngle(kind: ElementKind, sheet: Sheet): number {
    return this.catalog.surfaceOf(kind) === 'wrapper' ? sheet.rotationConfig.angleDeg : 0;
  }

  private configuredColor(sheet: Sheet): string {
    const declared = sheet.styleValues.values[ElementFieldId.PRIMARY_COLOR];
    return typeof declared === 'string' ? declared : UNKNOWN_COLOR;
  }
}
