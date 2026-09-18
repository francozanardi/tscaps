import type { Document, ScopedRenderOverride, Segment } from '@tscaps/engine';
import { ElementRenderOverrides } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { SegmentFontStylesBuilder } from '@core/fonts/services/SegmentFontStylesBuilder';

/** Font declarations to layer over a render's own overrides, keyed by sheet id. */
export interface CaptionFontOverrides {
  /** For the elements inside a segment: its lines and its words. */
  readonly subtreeBySheet: Readonly<Record<string, ElementRenderOverrides>>;
  readonly segmentsBySheet: Readonly<Record<string, ElementRenderOverrides>>;
}

/**
 * Derives every font-family declaration a render needs beyond the sheet
 * wrapper, as one self-contained artifact: the resolved font variable
 * for each segment and line the reader gave a font of its own, and the
 * declaration for each such word. The caller layers the result over its
 * own overrides; nothing else about the render changes.
 *
 * What each element declares is decided one segment at a time by the same
 * collaborator the preview asks, so a whole document renders the way the
 * segment under the playhead already looked.
 */
export class CaptionFontOverridesBuilder {

  constructor(private readonly segmentFontStylesBuilder: SegmentFontStylesBuilder) {}

  build(doc: Document, sheets: ReadonlyArray<Sheet>, elementStyles: ElementStyles): CaptionFontOverrides {
    const sheetsById = new Map<string, Sheet>(sheets.map((sheet) => [sheet.id, sheet]));
    const subtreeBySheet: Record<string, ElementRenderOverrides> = {};
    const segmentsBySheet: Record<string, ElementRenderOverrides> = {};
    for (const section of doc.sections) {
      const sheet = sheetsById.get(section.kind);
      if (!sheet) continue;
      const subtreeEntries: Array<readonly [string, ScopedRenderOverride]> = [];
      const segmentEntries: Array<readonly [string, ScopedRenderOverride]> = [];
      for (const segment of section.segments) {
        this.collectSegment(sheet, segment, elementStyles, subtreeEntries, segmentEntries);
      }
      if (subtreeEntries.length > 0) subtreeBySheet[sheet.id] = ElementRenderOverrides.fromEntries(subtreeEntries);
      if (segmentEntries.length > 0) segmentsBySheet[sheet.id] = ElementRenderOverrides.fromEntries(segmentEntries);
    }
    return { subtreeBySheet, segmentsBySheet };
  }

  private collectSegment(
    sheet: Sheet,
    segment: Segment,
    elementStyles: ElementStyles,
    subtreeEntries: Array<readonly [string, ScopedRenderOverride]>,
    segmentEntries: Array<readonly [string, ScopedRenderOverride]>,
  ): void {
    const segmentVars = this.segmentFontStylesBuilder.buildSegmentFontVars(sheet, segment, elementStyles);
    if (Object.keys(segmentVars).length > 0) {
      segmentEntries.push([segment.id, { inlineStyles: { ...segmentVars } }]);
    }
    const lineVars = this.segmentFontStylesBuilder.buildLineFontVars(sheet, segment, elementStyles);
    for (const [lineId, vars] of lineVars) {
      subtreeEntries.push([lineId, { inlineStyles: { ...vars } }]);
    }
    const wordFamilies = this.segmentFontStylesBuilder.buildWordFontFamilies(sheet, segment, elementStyles);
    for (const [wordId, fontFamily] of wordFamilies) {
      subtreeEntries.push([wordId, { inlineStyles: { 'font-family': fontFamily } }]);
    }
  }
}
