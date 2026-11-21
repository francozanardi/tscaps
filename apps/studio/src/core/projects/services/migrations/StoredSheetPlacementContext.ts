import type { HorizontalSide, PhysicalSide, TextDirection, VerticalAlign } from '@tscaps/engine';
import type { HorizontalPlacement, HorizontalPlacementResolver } from '@tscaps/engine/advanced';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';

const DEFAULT_VERTICAL_ALIGN: VerticalAlign = 'bottom';
const DEFAULT_HORIZONTAL_ALIGN: HorizontalSide = 'center';
const DEFAULT_OFFSET = 0.5;

/**
 * Completes a position stored before the anchor was kept next to its
 * offset.
 *
 * Such a position carries an offset alone, and the offset was read
 * against whatever anchor its sheet happened to hold at the time — so
 * any later move of that anchor renamed a place nobody edited.
 * Stamping the anchor the sheet holds right now freezes the position
 * the element already has: it does not move, and it stops answering to
 * the sheet. Horizontal offsets are restated in screen terms in the
 * same pass, because that is the vocabulary a stored anchor speaks.
 *
 * A position that already carries both of its anchors passes through
 * untouched. One with neither offset is nothing at all.
 */
export class StoredSheetPlacementContext {
  constructor(
    private readonly horizontalPlacementResolver: HorizontalPlacementResolver,
    private readonly sheets: ReadonlyArray<unknown>,
  ) {}

  complete(stored: Record<string, unknown>, sheetId: string): ElementPlacement | null {
    if (this.numberAt(stored, 'verticalOffset') === null && this.numberAt(stored, 'horizontalOffset') === null) {
      return null;
    }
    const alignment = this.recordAt(this.sheetAt(sheetId), 'alignmentConfig');
    const horizontal = this.horizontalOf(stored, alignment, sheetId);
    return {
      verticalAlign: this.verticalAlignAt(stored) ?? this.verticalAlignAt(alignment) ?? DEFAULT_VERTICAL_ALIGN,
      verticalOffset: this.numberAt(stored, 'verticalOffset') ?? this.numberAt(alignment, 'verticalOffset') ?? DEFAULT_OFFSET,
      horizontalAlign: horizontal.side,
      horizontalOffset: horizontal.offsetFromLeft,
    };
  }

  private horizontalOf(
    stored: Record<string, unknown>,
    alignment: Record<string, unknown> | null,
    sheetId: string,
  ): HorizontalPlacement {
    const side = this.physicalSideAt(stored);
    const offset = this.numberAt(stored, 'horizontalOffset');
    if (side !== null && offset !== null) return { side, offsetFromLeft: offset };
    return this.horizontalPlacementResolver.resolve(
      this.horizontalSideAt(alignment) ?? DEFAULT_HORIZONTAL_ALIGN,
      offset ?? this.numberAt(alignment, 'horizontalOffset') ?? DEFAULT_OFFSET,
      this.textDirectionOf(sheetId),
    );
  }

  private textDirectionOf(sheetId: string): TextDirection {
    return this.textAt(this.sheetAt(sheetId), 'textDirection') === 'rtl' ? 'rtl' : 'ltr';
  }

  private sheetAt(sheetId: string): Record<string, unknown> | null {
    for (const sheet of this.sheets) {
      if (this.textAt(sheet, 'id') === sheetId) return sheet as Record<string, unknown>;
    }
    return null;
  }

  private verticalAlignAt(value: unknown): VerticalAlign | null {
    const held = this.textAt(value, 'verticalAlign');
    return held === 'top' || held === 'center' || held === 'bottom' ? held : null;
  }

  private horizontalSideAt(value: unknown): HorizontalSide | null {
    const held = this.textAt(value, 'horizontalAlign');
    return held === 'start' || held === 'end' ? held : this.physicalSideAt(value);
  }

  private physicalSideAt(value: unknown): PhysicalSide | null {
    const held = this.textAt(value, 'horizontalAlign');
    return held === 'left' || held === 'center' || held === 'right' ? held : null;
  }

  private recordAt(value: unknown, key: string): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null) return null;
    const held = (value as Record<string, unknown>)[key];
    if (typeof held !== 'object' || held === null || Array.isArray(held)) return null;
    return held as Record<string, unknown>;
  }

  private textAt(value: unknown, key: string): string | null {
    if (typeof value !== 'object' || value === null) return null;
    const held = (value as Record<string, unknown>)[key];
    return typeof held === 'string' ? held : null;
  }

  private numberAt(value: unknown, key: string): number | null {
    if (typeof value !== 'object' || value === null) return null;
    const held = (value as Record<string, unknown>)[key];
    return typeof held === 'number' && Number.isFinite(held) ? held : null;
  }
}
