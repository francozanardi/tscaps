import type { Document, DecorationPlacementSide, ScopedRenderOverride, SubtitleStyle } from '@tscaps/engine';
import type { SegmentSubtreeOverrides } from '@core/captions/services/SegmentSubtreeOverridesBuilder';
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
import type { SegmentSubtreeOverridesBuilder } from '@core/captions/services/SegmentSubtreeOverridesBuilder';

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
  /** Words and glyphs a contributor paints under the top layer while their segment paints over it. */
  readonly elementsUnderTopLayer: ReadonlySet<string>;
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
    private readonly subtreeOverridesBuilder: SegmentSubtreeOverridesBuilder,
  ) {}

  build(request: SubtitleStyleSetRequest): Record<string, SubtitleStyle> {
    const { sourceDocument, renderDocument, sheets, elementStyles } = request;
    const fontOverrides = this.captionFontOverridesBuilder.build(renderDocument, sheets, elementStyles);
    const overridesBySegment = this.collectSegmentSubtreeOverrides(renderDocument, elementStyles, request.elementsUnderTopLayer);
    const placementsBySheet = this.collectWordOverrides(renderDocument, overridesBySegment);
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
          .collectSegmentOverrides(sourceDocument, sheet, elementStyles, request.contributedSegmentClasses, overridesBySegment)
          .mergedWith(fontOverrides.segmentsBySheet[sheet.id] ?? ElementRenderOverrides.empty()),
        svgFilters: new SvgFilterBundle(this.svgFilterDefinitionsResolver.resolve(sheet), new SheetSvgFilterScopeProvider(sheet)),
        decorationPlacements: decorationPlacementsBySheet[sheet.id] ?? new Map<string, DecorationPlacementSide>(),
      };
    }
    return styles;
  }

  /**
   * The overrides of every segment the render paints, from the one
   * builder the preview asks too, keyed by segment id. Read off the
   * render document, which is the one the renderer walks.
   */
  private collectSegmentSubtreeOverrides(
    doc: Document,
    elementStyles: ElementStyles,
    elementsUnderTopLayer: ReadonlySet<string>,
  ): ReadonlyMap<string, SegmentSubtreeOverrides> {
    const bySegment = new Map<string, SegmentSubtreeOverrides>();
    for (const segment of doc.getSegments()) {
      bySegment.set(segment.id, this.subtreeOverridesBuilder.build(segment, elementStyles, elementsUnderTopLayer));
    }
    return bySegment;
  }

  /**
   * Groups the overrides of every word and glyph by the sheet id of the
   * section it belongs to. The renderer dispatches per frame using
   * `Section.kind` as the lookup key, so each bucket maps to one
   * `SubtitleStyle.subtreeOverrides`.
   */
  private collectWordOverrides(
    doc: Document,
    overridesBySegment: ReadonlyMap<string, SegmentSubtreeOverrides>,
  ): Record<string, ElementRenderOverrides> {
    const result: Record<string, ElementRenderOverrides> = {};
    for (const section of doc.sections) {
      for (const segment of section.segments) {
        const subtree = overridesBySegment.get(segment.id)?.subtree;
        if (!subtree || subtree.isEmpty()) continue;
        result[section.kind] = (result[section.kind] ?? ElementRenderOverrides.empty()).mergedWith(subtree);
      }
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

  /**
   * Builds the per-segment overrides for a sheet by walking the
   * document's segments in document order, asking the rotation resolver
   * for each and merging the user's per-segment overrides with the
   * contributed classes. Segments with no inline-style, no alignment
   * override, no classes, no isolation and no pass are omitted so the
   * renderer falls back to the sheet's root defaults. The segments are
   * walked in the source document, which is what the color rotation
   * counts over; a segment the render cut away simply finds no
   * overrides of its own.
   */
  private collectSegmentOverrides(
    doc: Document,
    sheet: Sheet,
    elementStyles: ElementStyles,
    contributedSegmentClasses: ReadonlyMap<string, ReadonlyArray<string>>,
    overridesBySegment: ReadonlyMap<string, SegmentSubtreeOverrides>,
  ): ElementRenderOverrides {
    const entries: Array<readonly [string, ScopedRenderOverride]> = [];
    let segIdx = 0;
    for (const section of doc.sections) {
      if (section.kind !== sheet.id) continue;
      for (const segment of section.segments) {
        const inlineStyles = this.segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx);
        const alignment = elementStyles.placementOf(segment.id);
        const classes = contributedSegmentClasses.get(segment.id);
        const own = overridesBySegment.get(segment.id)?.segment;
        const scoped: ScopedRenderOverride = {
          ...(Object.keys(inlineStyles).length > 0 ? { inlineStyles } : {}),
          ...(alignment ? { alignment } : {}),
          ...(classes && classes.length > 0 ? { classes } : {}),
          ...own,
        };
        if (Object.keys(scoped).length > 0) entries.push([segment.id, scoped]);
        segIdx++;
      }
    }
    return ElementRenderOverrides.fromEntries(entries);
  }
}
