import type { Document, DecorationPlacementSide, ScopedRenderOverride, SubtitleStyle } from '@tscaps/engine';
import { ElementRenderOverrides, SvgFilterBundle } from '@tscaps/engine';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import type { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import type { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';
import type { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';

export interface SubtitleStyleSetRequest {
  /**
   * The document as authored, cuts not applied. Segment ordering and
   * the set of fonts in play are read from here so neither shifts when
   * the user cuts material out.
   */
  readonly sourceDocument: Document;
  /** The document as it will be burned, cuts and hidden decorations applied. */
  readonly renderDocument: Document;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly elementStyles: ElementStyles;
  readonly contributedSegmentClasses: ReadonlyMap<string, ReadonlyArray<string>>;
}

/**
 * Maps each `Sheet` onto the `SubtitleStyle` the renderer dispatches to
 * for the sections that name it, keyed by sheet id.
 *
 * The export SVG runs in an isolated CSS context that cannot see the
 * host page's stylesheets, so each sheet's own CSS is prefixed with the
 * `@font-face` declarations for the families it uses; the engine then
 * inlines the referenced woff2 files as data URIs.
 *
 * Pure: the same request always builds the same set, and nothing here
 * touches the editor, the renderer, or any store.
 */
export class SubtitleStyleSetBuilder {

  constructor(
    private readonly sheetCssVarsBuilder: SheetCssVarsBuilder,
    private readonly layeredCaptionCssBuilder: LayeredCaptionCssBuilder,
    private readonly captionFontOverridesBuilder: CaptionFontOverridesBuilder,
    private readonly segmentColorRotation: SegmentColorRotation,
    private readonly sheetFontFacesBuilder: SheetFontFacesBuilder,
    private readonly documentUsedCodepointCollector: DocumentUsedCodepointCollector,
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
    private readonly decorationPlacementResolver: DecorationPlacementResolver,
  ) {}

  build(request: SubtitleStyleSetRequest): Record<string, SubtitleStyle> {
    const { sourceDocument, renderDocument, sheets, elementStyles } = request;
    const fontOverrides = this.captionFontOverridesBuilder.build(renderDocument, sheets, elementStyles);
    const placementsBySheet = this.collectWordPlacements(renderDocument, elementStyles);
    const decorationPlacementsBySheet = this.collectDecorationPlacements(renderDocument, sheets);
    const usedCodepoints = this.documentUsedCodepointCollector.collect(renderDocument);

    const styles: Record<string, SubtitleStyle> = {};
    for (const sheet of sheets) {
      const inlineStyles = this.sheetCssVarsBuilder.build(sheet);
      const sheetCss = sheet.resolveCss();
      const fontFaces = this.sheetFontFacesBuilder.build({
        sheet,
        document: sourceDocument,
        sheetCss,
        elementStyles,
        usedCodepoints,
      });
      const layeredCss = this.layeredCaptionCssBuilder.build(
        sheetCss,
        sheet.animations,
        elementStyles,
      );
      const webRendering = sheet.template.rendering;
      styles[sheet.id] = {
        // `@font-face` stays outside the layers: it declares no
        // properties to cascade, and layering it would only make the
        // rules harder to read.
        css: fontFaces ? `${fontFaces}\n${layeredCss}` : layeredCss,
        addressableElementIds: elementStyles.elementIds(),
        inlineStyles,
        alignment: sheet.alignmentConfig,
        rendering: {
          splitWordsIntoLetters: webRendering.splitWordsIntoLetters,
          videoFrame: {
            required: webRendering.videoFrame.required,
            jpegQuality: webRendering.videoFrame.jpegQuality,
          },
          padding: webRendering.padding,
          textDirection: sheet.textDirection,
        },
        subtreeOverrides: (placementsBySheet[sheet.id] ?? ElementRenderOverrides.empty())
          .mergedWith(fontOverrides.subtreeBySheet[sheet.id] ?? ElementRenderOverrides.empty()),
        segmentOverrides: this
          .collectSegmentOverrides(sourceDocument, sheet, elementStyles, request.contributedSegmentClasses)
          .mergedWith(fontOverrides.segmentsBySheet[sheet.id] ?? ElementRenderOverrides.empty()),
        svgFilters: new SvgFilterBundle(this.svgFilterDefinitionsResolver.resolve(sheet), new SheetSvgFilterScopeProvider(sheet)),
        decorationPlacements: decorationPlacementsBySheet[sheet.id] ?? new Map<string, DecorationPlacementSide>(),
      };
    }
    return styles;
  }

  /**
   * Groups every placed word and glyph by the sheet id of the section
   * it belongs to. The renderer dispatches per frame using
   * `Section.kind` as the lookup key, so each bucket maps to one
   * `SubtitleStyle.subtreeOverrides`.
   */
  private collectWordPlacements(
    doc: Document,
    elementStyles: ElementStyles,
  ): Record<string, ElementRenderOverrides> {
    const buckets: Record<string, Array<readonly [string, ScopedRenderOverride]>> = {};
    for (const section of doc.sections) {
      const sheetId = section.kind;
      for (const segment of section.segments) {
        for (const line of segment.lines) {
          for (const word of line.words) {
            const wordEntry = this.buildPlacementEntry(word.id, elementStyles);
            if (wordEntry) {
              const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
              bucket.push([word.id, wordEntry]);
            }
            if (word.decoration) {
              const decorationEntry = this.buildPlacementEntry(word.decoration.id, elementStyles);
              if (decorationEntry) {
                const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
                bucket.push([word.decoration.id, decorationEntry]);
              }
            }
          }
        }
      }
    }
    const result: Record<string, ElementRenderOverrides> = {};
    for (const [sheetId, entries] of Object.entries(buckets)) {
      result[sheetId] = ElementRenderOverrides.fromEntries(entries);
    }
    return result;
  }

  /**
   * Groups the sheet's default decoration placements by the host
   * sheet id, flattened across every segment in the section so the
   * renderer can look up by decoration id alone.
   */
  private collectDecorationPlacements(
    doc: Document,
    sheets: ReadonlyArray<Sheet>,
  ): Record<string, Map<string, DecorationPlacementSide>> {
    const sheetsById = new Map<string, Sheet>(sheets.map((s) => [s.id, s]));
    const result: Record<string, Map<string, DecorationPlacementSide>> = {};
    for (const section of doc.sections) {
      const sheet = sheetsById.get(section.kind);
      if (!sheet) continue;
      for (const segment of section.segments) {
        const perSegment = this.decorationPlacementResolver.buildSegmentPlacements(sheet, segment);
        if (perSegment.size === 0) continue;
        const bucket = result[sheet.id] ?? (result[sheet.id] = new Map<string, DecorationPlacementSide>());
        for (const [decorationId, side] of perSegment) bucket.set(decorationId, side);
      }
    }
    return result;
  }

  private buildPlacementEntry(elementId: string, elementStyles: ElementStyles): ScopedRenderOverride | null {
    const placement = elementStyles.placementOf(elementId);
    return placement ? { alignment: placement } : null;
  }

  /**
   * Builds the per-segment overrides for a sheet by walking the
   * document's segments in document order, asking the rotation resolver
   * for each and merging the user's per-segment overrides with the
   * contributed classes. Segments with no inline-style, no alignment
   * override and no classes are omitted so the renderer falls back to
   * the sheet's root defaults.
   */
  private collectSegmentOverrides(
    doc: Document,
    sheet: Sheet,
    elementStyles: ElementStyles,
    contributedSegmentClasses: ReadonlyMap<string, ReadonlyArray<string>>,
  ): ElementRenderOverrides {
    const entries: Array<readonly [string, ScopedRenderOverride]> = [];
    let segIdx = 0;
    for (const section of doc.sections) {
      if (section.kind !== sheet.id) continue;
      for (const segment of section.segments) {
        const inlineStyles = this.segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx);
        const alignment = elementStyles.placementOf(segment.id);
        const classes = contributedSegmentClasses.get(segment.id);
        const scoped: ScopedRenderOverride = {
          ...(Object.keys(inlineStyles).length > 0 ? { inlineStyles } : {}),
          ...(alignment ? { alignment } : {}),
          ...(classes && classes.length > 0 ? { classes } : {}),
        };
        if (scoped.inlineStyles || scoped.alignment || scoped.classes) entries.push([segment.id, scoped]);
        segIdx++;
      }
    }
    return ElementRenderOverrides.fromEntries(entries);
  }
}
