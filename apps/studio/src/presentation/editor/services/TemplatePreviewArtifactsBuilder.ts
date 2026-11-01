import type { FontStackCssVarsBuilder } from '@core/fonts/services/FontStackCssVarsBuilder';
import { CssMinifier, CssScoper, DECORATION_CONTAINER_BASELINE_CSS, FROZEN_FRAME_CSS, LINE_NO_WRAP_CSS, SvgFilterScoper, SvgFilterLengthResolver, SvgFilterDefsRenderer } from '@tscaps/engine';
import type { DecorationPlacementSide } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import type { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import type { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';
import type { EmojiCssVarBuilder } from '@core/effect/services/EmojiCssVarBuilder';
import { EMOJI_PLACEMENT_DEFAULT, type EmojiEffectConfig } from '@core/effect/domain/EffectConfig';
import type { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';

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
  private readonly svgFilterDefsRenderer = new SvgFilterDefsRenderer(this.svgFilterScoper, new SvgFilterLengthResolver());

  constructor(
    private readonly typographyCssVarBuilder: TypographyCssVarBuilder,
    private readonly rotationCssVarBuilder: RotationCssVarBuilder,
    private readonly styleValuesCssVarsBuilder: StyleValuesCssVarsBuilder,
    private readonly fontStackCssVarsBuilder: FontStackCssVarsBuilder,
    private readonly emojiCssVarBuilder: EmojiCssVarBuilder,
    private readonly decorationPlacementResolver: DecorationPlacementResolver,
  ) {}

  /**
   * Template CSS minified, with filter refs rewritten to the runtime
   * indirection, scoped under `scopeClass`, and prefixed with the
   * engine's frozen-frame rule scoped the same way — a card paints one
   * seeked frame, so a template's `animation: … infinite` would
   * otherwise keep ticking on every visible card. The engine's no-wrap
   * default for lines comes before the template too, so a template that
   * sets its own `white-space` wins as it does in export, and so do its
   * emoji rules and the positioned segment the emoji rows hang from.
   */
  buildScopedCss(template: Template, scopeClass: string): string {
    const scopeSelector = `.${scopeClass}`;
    const minified = this.cssMinifier.minify(template.getCss());
    const { css: withIndirectFilters } = this.svgFilterScoper.rewriteCss(minified);
    const scopedCss = this.cssScoper.scope(withIndirectFilters, scopeSelector);
    const baseline = `${FROZEN_FRAME_CSS}\n${LINE_NO_WRAP_CSS}\n.segment { position: relative; }\n${DECORATION_CONTAINER_BASELINE_CSS}`;
    return `${this.cssScoper.scope(baseline, scopeSelector)}\n${scopedCss}`;
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
      ...this.fontStackCssVarsBuilder.build(template.fontStackIds, null),
      ...this.typographyCssVarBuilder.build(template.typography, 'ltr', null),
      ...this.rotationCssVarBuilder.build(template.rotation),
      ...this.styleValuesCssVarsBuilder.build(StyleValues.fromTemplate(template.styleControls), null),
      ...this.emojiCssVarBuilder.build(this.emojiConfigOf(template)),
    };
  }

  /**
   * The side of the card's caption its emojis paint in a row on, or
   * `null` when they stay inside their word. A card shows one caption,
   * the first, so a placement that picks a side per caption picks the
   * first caption's.
   */
  buildEmojiSide(template: Template): DecorationPlacementSide | null {
    const placement = this.emojiConfigOf(template)?.placement ?? EMOJI_PLACEMENT_DEFAULT;
    return this.decorationPlacementResolver.sideOf(placement, 0);
  }

  private emojiConfigOf(template: Template): EmojiEffectConfig | null {
    return template.effectConfigs.find((config): config is EmojiEffectConfig => config.type === 'emoji') ?? null;
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

    const sheet = Sheet.fromTemplate(template.metadata.id, template.metadata.name, null, template, 'ltr');
    const provider = new SheetSvgFilterScopeProvider(sheet);
    const context = { currentTime: 0, renderHeightPx: virtualVideoHeightPx };
    const { defs, bindings } = this.svgFilterDefsRenderer.render(
      definitions,
      provider.scopeAt(context),
      provider.lengthFactorsAt(context),
      scopeClass,
    );
    return { filterDefsHtml: defs, filterUrlVars: Object.fromEntries(bindings) };
  }
}
