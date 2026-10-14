import type { Document, Segment } from '@tscaps/engine';
import type { SegmentVisibilitySettings } from '@core/captions/domain/SegmentVisibilitySettings';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * Decides `hidden` for every segment: the user's override when there is
 * one, otherwise hidden when brief scenes are hidden and the segment is
 * on screen for less than its sheet's template allows
 * (`features.briefSceneMs`). A segment whose window was named
 * (`customTime`) is never brief.
 *
 * Judged on `segment.time`, so it expects a document whose effects have
 * already run. Returns `document` itself when no segment changes.
 */
export class SegmentVisibilityResolver {
  constructor(private readonly settings: SegmentVisibilitySettings) {}

  resolve(document: Document, sheets: ReadonlyArray<Sheet>): Document {
    const overrides = this.settings.overrides();
    const hidesBrief = this.settings.hidesBriefScenes();
    const briefMsBySheetId = new Map(sheets.map((sheet) => [sheet.id, sheet.template.features.briefSceneMs]));
    return this.mapSegments(document, (segment, sheetId) => {
      const override = overrides.get(segment.id);
      const hidden = override === 'auto'
        ? hidesBrief && this.isBrief(segment, briefMsBySheetId.get(sheetId) ?? 0)
        : override === 'hidden';
      return hidden === segment.hidden ? segment : segment.with({ hidden });
    });
  }

  /** Paints every segment again, so the effects can measure them all before `resolve`. */
  reveal(document: Document): Document {
    return this.mapSegments(document, (segment) => (segment.hidden ? segment.with({ hidden: false }) : segment));
  }

  private isBrief(segment: Segment, briefMs: number): boolean {
    if (segment.customTime) return false;
    return Math.round((segment.time.end - segment.time.start) * 1000) < briefMs;
  }

  private mapSegments(document: Document, transform: (segment: Segment, sheetId: string) => Segment): Document {
    const sections = document.sections.map((section) => {
      const segments = section.segments.map((segment) => transform(segment, section.kind));
      const changed = segments.some((segment, i) => segment !== section.segments[i]);
      return changed ? section.with({ segments }) : section;
    });
    const changed = sections.some((section, i) => section !== document.sections[i]);
    return changed ? document.with({ sections }) : document;
  }
}
