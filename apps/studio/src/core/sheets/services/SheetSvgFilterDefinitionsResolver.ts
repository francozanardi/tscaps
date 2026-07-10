import { SvgFilterDefinitions, SvgFilterDefinitionsParser } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * Resolves the parsed `SvgFilterDefinitions` for a Sheet. Honors the
 * sheet's `filtersSvgOverride` when set and falls back to the
 * template's pristine definitions when the override is absent or
 * unparseable, so the render path always gets a usable result.
 *
 * Results are memoized by Sheet identity. Sheets are immutable, so a
 * cached entry stays valid for the lifetime of the Sheet instance and
 * the WeakMap releases entries as old Sheets are garbage-collected.
 */
export class SheetSvgFilterDefinitionsResolver {
  private readonly definitionsBySheet = new WeakMap<Sheet, SvgFilterDefinitions>();

  constructor(private readonly parser: SvgFilterDefinitionsParser) {}

  resolve(sheet: Sheet): SvgFilterDefinitions {
    if (sheet.filtersSvgOverride === null) {
      return sheet.template.svgFilterDefinitions;
    }
    const cached = this.definitionsBySheet.get(sheet);
    if (cached) return cached;
    const resolved = this.parseOrFallback(sheet);
    this.definitionsBySheet.set(sheet, resolved);
    return resolved;
  }

  private parseOrFallback(sheet: Sheet): SvgFilterDefinitions {
    try {
      return this.parser.parse(sheet.filtersSvgOverride!);
    } catch {
      return sheet.template.svgFilterDefinitions;
    }
  }
}
