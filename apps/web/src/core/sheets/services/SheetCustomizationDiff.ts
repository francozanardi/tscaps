import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';

/**
 * Computes which properties of a Sheet differ from the defaults its
 * Template ships. The result is a flat list of analytics-friendly
 * property names — typography sub-fields and per-control style values
 * are reported individually because they map to user-visible knobs;
 * splitter / alignment / effects / source overrides are reported as
 * single coarse markers because they are composite configs whose
 * inner shape varies by template author.
 *
 * Pure: no I/O, no mutation, no observable state.
 */
export class SheetCustomizationDiff {

  diff(sheet: Sheet): readonly string[] {
    const customized: string[] = [];
    this.collectTypographyDiff(sheet, customized);
    this.collectStyleControlsDiff(sheet, customized);
    this.collectAlignmentDiff(sheet, customized);
    this.collectSplittersDiff(sheet, customized);
    this.collectEffectsDiff(sheet, customized);
    this.collectSourceOverrides(sheet, customized);
    return customized;
  }

  private collectTypographyDiff(sheet: Sheet, out: string[]): void {
    const current = sheet.typographyConfig;
    const defaults = sheet.template.typography;
    for (const key of Object.keys(current) as ReadonlyArray<keyof TypographyConfig>) {
      if (current[key] !== defaults[key]) out.push(`typography.${key}`);
    }
  }

  private collectStyleControlsDiff(sheet: Sheet, out: string[]): void {
    const values = sheet.styleValues.values;
    for (const field of sheet.template.styleControls) {
      if (values[field.id] !== field.default) out.push(`style:${field.id}`);
    }
  }

  private collectAlignmentDiff(sheet: Sheet, out: string[]): void {
    if (!this.structurallyEqual(sheet.alignmentConfig, sheet.template.alignment)) {
      out.push('alignment');
    }
  }

  private collectSplittersDiff(sheet: Sheet, out: string[]): void {
    if (!this.structurallyEqual(sheet.segmentSplitterConfigs, sheet.template.segmentSplitterConfigs)) {
      out.push('segment_splitter');
    }
    if (!this.structurallyEqual(sheet.lineSplitterConfig, sheet.template.lineSplitter)) {
      out.push('line_splitter');
    }
  }

  private collectEffectsDiff(sheet: Sheet, out: string[]): void {
    if (!this.structurallyEqual(sheet.effectConfigs, sheet.template.effectConfigs)) {
      out.push('effects');
    }
  }

  private collectSourceOverrides(sheet: Sheet, out: string[]): void {
    if (sheet.cssOverride !== null) out.push('css_override');
    if (sheet.filtersSvgOverride !== null) out.push('filters_svg_override');
  }

  /**
   * Structural equality for the plain immutable configs the sheet
   * holds (no `Map`, no `Set`, no `Date`, no class instances). Both
   * sides come from the same template-derivation path so key order
   * is stable, which lets the JSON encoding double as a canonical
   * form.
   */
  private structurallyEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
