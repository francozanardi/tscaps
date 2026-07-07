import type { Document } from '@modules/document/Document';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { CssScoper } from '@modules/css/CssScoper';
import type { CssMinifier } from '@modules/css/CssMinifier';
import type { CssVarReferenceScanner } from '@modules/css/CssVarReferenceScanner';
import type { BaselineCssComposer, BaselineNeeds } from '@modules/rendering/styles/BaselineCssComposer';
import type { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import type { SegmentPaddingCssRuleBuilder } from '@modules/rendering/styles/SegmentPaddingCssRuleBuilder';
import { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { InlineStyleEmitter } from '@modules/rendering/styles/InlineStyleEmitter';
import type { RenderingConfig } from '@modules/rendering/types/RenderingConfig';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

/**
 * Prepares a `SubtitleStyle` for downstream rendering: minifies and
 * embeds the CSS, scopes it to a unique class, mounts a probe
 * container in the host document, computes the baseline needs, and
 * wires the per-style `InlineStyleEmitter` that filters unused CSS
 * custom properties from inline styles.
 */
export class PreparedStyleFactory {

  constructor(
    private readonly cssEmbedder: CssResourceEmbedder,
    private readonly cssScoper: CssScoper,
    private readonly cssMinifier: CssMinifier,
    private readonly cssVarReferenceScanner: CssVarReferenceScanner,
    private readonly baselineCssComposer: BaselineCssComposer,
    private readonly svgFilterScoper: SvgFilterScoper,
    private readonly segmentPaddingCssRuleBuilder: SegmentPaddingCssRuleBuilder,
  ) {}

  async create(kind: string, style: SubtitleStyle, doc: Document): Promise<PreparedStyle> {
    const cssWithPadding = this.prependSegmentPaddingRule(style.css, style.rendering);
    const minified = this.cssMinifier.minify(cssWithPadding);
    const embedded = await this.cssEmbedder.embed(minified);
    const scopeClass = `tscaps-render-${kind}-${Math.random().toString(36).slice(2, 8)}`;
    const { css: cssWithIndirectFilters } = this.svgFilterScoper.rewriteCss(embedded);
    const scopedCss = this.cssScoper.scope(cssWithIndirectFilters, `.${scopeClass}`);

    const baselineNeeds: BaselineNeeds = {
      decorations: this.hasDecorationsForKind(doc, kind),
      videoFrame: style.rendering.videoFrame.required,
    };
    const baselineCss = this.baselineCssComposer.compose(baselineNeeds);

    // Probe styles live in `document.head` while a render is open;
    // without the scopeClass guard, any `.word`/`.line`/etc on the
    // host page would inherit them.
    const scopedBaseline = this.cssScoper.scope(baselineCss, `.${scopeClass}`);
    const probeStyleEl = document.createElement('style');
    probeStyleEl.textContent = scopedBaseline + scopedCss;
    document.head.appendChild(probeStyleEl);

    const probeContainer = document.createElement('div');
    probeContainer.className = scopeClass;
    probeContainer.style.cssText = 'position:fixed;left:-99999px;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probeContainer);

    const usedCssVars = this.cssVarReferenceScanner.scan(baselineCss + scopedCss);

    return {
      kind,
      scopedCss,
      filters: style.svgFilters ?? SvgFilterBundle.empty({
        scopeAt: () => SvgFilterScope.empty(),
        lengthFactorsAt: () => ({ pxPerEm: 0, pxPerCqh: 0 }),
      }),
      inlineStyles: style.inlineStyles,
      alignment: style.alignment,
      rendering: style.rendering,
      wordOverrides: style.wordOverrides ?? ElementRenderOverrides.empty(),
      segmentOverrides: style.segmentOverrides ?? ElementRenderOverrides.empty(),
      decorationPlacements: style.decorationPlacements ?? new Map<string, DecorationPlacementSide>(),
      probeStyleElement: probeStyleEl,
      probeContainer,
      scopeClass,
      inlineStyleEmitter: new InlineStyleEmitter(usedCssVars),
      baselineNeeds,
      baselineCss,
    };
  }

  private prependSegmentPaddingRule(css: string, rendering: RenderingConfig): string {
    const rule = this.segmentPaddingCssRuleBuilder.build(rendering.padding);
    return rule ? `${rule}\n${css}` : css;
  }

  private hasDecorationsForKind(doc: Document, kind: string): boolean {
    for (const section of doc.sections) {
      if (section.kind !== kind) continue;
      for (const word of section.getWords()) {
        if (word.decoration) return true;
      }
    }
    return false;
  }
}
