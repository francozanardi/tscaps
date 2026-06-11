import type { Document, Segment } from '@tscaps/engine';
import { CssMinifier, CssScoper, SvgFilterBundle, SvgFilterScoper } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import { SegmentPositionsBySheet } from '@presentation/editor/services/SegmentPositionsBySheet';

/**
 * Builds the time-independent, alignment-independent CSS artifacts the
 * overlay paints for one sheet: the scope class name applied to the
 * wrapper, the scoped stylesheet, and the wrapper CSS variables
 * (typography + SVG filter URL bindings). Also derives the cross-sheet
 * routing tables the overlay needs at render time. The engine's
 * CSS/SVG helpers are encapsulated here so the React layer never
 * references them.
 */
export class SheetOverlayArtifactsBuilder {
  private readonly cssMinifier = new CssMinifier();
  private readonly cssScoper = new CssScoper();
  private readonly svgFilterScoper = new SvgFilterScoper();

  constructor(
    private readonly sheetCssVarsBuilder: SheetCssVarsBuilder,
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
  ) {}

  /**
   * Selector class for the wrapper element of a sheet's subtree. Pair
   * with the CSS returned by {@link buildScopedCss} so the rules apply
   * to this sheet only.
   */
  scopeClassFor(sheetId: string): string {
    return `tscaps-sheet-${sheetId}`;
  }

  /**
   * Sheet's CSS minified, with `url(#id)` filter refs rewritten to the
   * `var(--svg-filter-id)` indirection the runtime binds, and scoped
   * under the wrapper's scope class.
   */
  buildScopedCss(sheet: Sheet): string {
    const minified = this.cssMinifier.minify(sheet.resolveCss());
    const { css: withIndirectFilters } = this.svgFilterScoper.rewriteCss(minified);
    return this.cssScoper.scope(withIndirectFilters, `.${this.scopeClassFor(sheet.id)}`);
  }

  /**
   * CSS variables applied on the sheet's wrapper: typography vars
   * merged with the `var()`-backed filter URL bindings the overlay
   * controller resolves on each tick.
   */
  buildWrapperVars(sheet: Sheet): Record<string, string> {
    return {
      ...this.sheetCssVarsBuilder.build(sheet),
      ...this.buildFilterUrlVars(sheet),
    };
  }

  /**
   * Position of every segment a sheet owns in document order.
   * Segments that belong to a sheet are numbered 0…N within that
   * sheet's section, regardless of the segments owned by other sheets.
   */
  buildSegmentPositions(doc: Document, sheets: ReadonlyArray<Sheet>): SegmentPositionsBySheet {
    const positions = new Map<string, Map<string, number>>();
    for (const sheet of sheets) {
      const perSheet = new Map<string, number>();
      let position = 0;
      for (const segment of doc.getSegments()) {
        if (segment.getSection().kind === sheet.id) perSheet.set(segment.id, position++);
      }
      positions.set(sheet.id, perSheet);
    }
    return new SegmentPositionsBySheet(positions);
  }

  /**
   * Map from active-segment id to the sheet that owns it. Segments
   * whose owning sheet was deleted are absent.
   */
  buildSheetBySegmentId(
    activeSegments: ReadonlyArray<Segment>,
    sheets: ReadonlyArray<Sheet>,
  ): Map<string, Sheet> {
    const map = new Map<string, Sheet>();
    for (const segment of activeSegments) {
      const sheet = sheets.find((s) => s.id === segment.getSection().kind);
      if (sheet) map.set(segment.id, sheet);
    }
    return map;
  }

  private buildFilterUrlVars(sheet: Sheet): Record<string, string> {
    const definitions = this.svgFilterDefinitionsResolver.resolve(sheet);
    const bundle = new SvgFilterBundle(definitions, new SheetSvgFilterScopeProvider(sheet));
    const { bindings } = this.svgFilterScoper.scopeIds(bundle.definitions.ids, sheet.id);
    const vars: Record<string, string> = {};
    for (const [name, url] of bindings) vars[name] = url;
    return vars;
  }
}
