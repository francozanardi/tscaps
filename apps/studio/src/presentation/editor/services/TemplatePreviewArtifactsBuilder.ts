import { CssMinifier, CssScoper, SvgFilterScoper, SvgFilterLengthResolver } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import type { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import type { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';

export interface TemplatePreviewFilterArtifacts {
  /** Concatenated `<filter>…</filter>` markup ready to inject under `<defs>`. */
  readonly filterDefsHtml: string;
  /** Map of CSS variable name → `url(#scopedId)` reference for the preview wrapper. */
  readonly filterUrlVars: Record<string, string>;
}

/**
 * Builds the CSS and SVG filter artifacts a template preview card
 * paints: the scoped stylesheet, the wrapper variables that mirror
 * the runtime overlay's recipe, and the materialized filter
 * definitions. Encapsulates every engine helper so the React card
 * stays purely declarative.
 */
export class TemplatePreviewArtifactsBuilder {
  private readonly cssMinifier = new CssMinifier();
  private readonly cssScoper = new CssScoper();
  private readonly svgFilterScoper = new SvgFilterScoper();
  private readonly svgFilterLengthResolver = new SvgFilterLengthResolver();

  constructor(
    private readonly typographyCssVarBuilder: TypographyCssVarBuilder,
    private readonly rotationCssVarBuilder: RotationCssVarBuilder,
    private readonly styleValuesCssVarsBuilder: StyleValuesCssVarsBuilder,
  ) {}

  /**
   * Template CSS minified, with filter refs rewritten to the runtime
   * indirection, scoped under `scopeClass`, and prefixed with a
   * pseudo-element pause rule. The pseudo-pause is here because
   * pseudos can't receive inline styles and don't inherit
   * animation-play-state, and the template's `animation:` shorthand
   * resets play-state to `running` — so the pause must be `!important`
   * to honour the paused-frame contract for anything templates
   * animate on ::before / ::after.
   */
  buildScopedCss(template: Template, scopeClass: string): string {
    const minified = this.cssMinifier.minify(template.getCss());
    const { css: withIndirectFilters } = this.svgFilterScoper.rewriteCss(minified);
    const scopedCss = this.cssScoper.scope(withIndirectFilters, `.${scopeClass}`);
    const pseudoPause = `.${scopeClass} *::before, .${scopeClass} *::after { animation-play-state: paused !important; animation-fill-mode: both; }`;
    return `${pseudoPause}\n${scopedCss}`;
  }

  /**
   * CSS variables applied on the preview wrapper. Mirrors the runtime
   * overlay's `Sheet.buildCssVars`: typography vars plus every style
   * control's default. Without the style-control half, the preview
   * silently falls back to CSS `var(..., fallback)` values, which
   * drift from the JSON defaults and make the preview disagree with
   * what the user gets on first use.
   */
  buildWrapperVars(template: Template): Record<string, string> {
    return {
      ...this.typographyCssVarBuilder.build(template.typography),
      ...this.rotationCssVarBuilder.build(template.rotation),
      ...this.styleValuesCssVarsBuilder.build(StyleValues.fromTemplate(template.styleControls)),
    };
  }

  /**
   * Materialized SVG filter defs the preview's CSS references, plus
   * the wrapper CSS variables that bind `url(#scopedId)` for each
   * filter. Lengths in `em` / `cqh` resolve against
   * `virtualVideoHeightPx`. Returns empty markup and an empty var
   * record when the template defines no filters.
   */
  buildFilterArtifacts(
    template: Template,
    scopeClass: string,
    virtualVideoHeightPx: number,
  ): TemplatePreviewFilterArtifacts {
    const definitions = template.svgFilterDefinitions;
    if (definitions.isEmpty()) return { filterDefsHtml: '', filterUrlVars: {} };

    const sheet = Sheet.fromTemplate(template.metadata.id, template.metadata.name, null, template);
    const provider = new SheetSvgFilterScopeProvider(sheet);
    const context = { currentTime: 0, renderHeightPx: virtualVideoHeightPx };
    const scope = provider.scopeAt(context);
    const lengthFactors = provider.lengthFactorsAt(context);
    const { idByLocal, bindings } = this.svgFilterScoper.scopeIds(definitions.ids, scopeClass);

    const filterDefsHtml = definitions.filters
      .map((filter) => {
        const body = this.svgFilterLengthResolver.resolve(filter.materialize(scope), lengthFactors);
        return `<filter id="${idByLocal.get(filter.id)}">${body}</filter>`;
      })
      .join('');
    return { filterDefsHtml, filterUrlVars: Object.fromEntries(bindings) };
  }
}
