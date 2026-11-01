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
import type { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';

// Embedded faces load in milliseconds; this only bounds a face that never
// does, so it cannot hold the render open.
const FONT_LOAD_TIMEOUT_MS = 5000;

// `!important`, so a sheet declaring any of them for its own layout
// cannot bring the probe container back on screen.
const PROBE_CONTAINER_STYLES: Record<string, string> = {
  position: 'fixed',
  left: '-99999px',
  visibility: 'hidden',
  'pointer-events': 'none',
};

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
    private readonly frameDemand: SubtitleStyleFrameDemand,
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
      isolation: this.frameDemand.isolatesAnyElement(style),
    };
    const baselineCss = this.baselineCssComposer.compose(baselineNeeds);

    // Probe styles live in `document.head` while a render is open;
    // without the scopeClass guard, any `.word`/`.line`/etc on the
    // host page would inherit them.
    const scopedBaseline = this.cssScoper.scope(baselineCss, `.${scopeClass}`);
    const probeStyleEl = document.createElement('style');
    probeStyleEl.textContent = scopedBaseline + scopedCss;
    document.head.appendChild(probeStyleEl);
    await this.loadDeclaredFonts(probeStyleEl);

    const probeContainer = document.createElement('div');
    probeContainer.className = scopeClass;
    for (const [property, value] of Object.entries(PROBE_CONTAINER_STYLES)) {
      probeContainer.style.setProperty(property, value, 'important');
    }
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
      subtreeOverrides: style.subtreeOverrides ?? ElementRenderOverrides.empty(),
      segmentOverrides: style.segmentOverrides ?? ElementRenderOverrides.empty(),
      decorationPlacements: style.decorationPlacements ?? new Map<string, DecorationPlacementSide>(),
      addressableElementIds: style.addressableElementIds ?? new Set<string>(),
      probeStyleElement: probeStyleEl,
      probeContainer,
      scopeClass,
      usedCssVars,
      inlineStyleEmitter: new InlineStyleEmitter(usedCssVars),
      baselineNeeds,
      baselineCss,
    };
  }

  /**
   * Loads the faces the stylesheet declares before anything measures in
   * the probe. A face loads only once text uses it, so without this the
   * first caption is measured in a fallback face. A face that fails, or
   * is still loading after `FONT_LOAD_TIMEOUT_MS`, is measured as before.
   */
  private async loadDeclaredFonts(styleElement: HTMLStyleElement): Promise<void> {
    const families = new Set<string>();
    this.collectFontFamilies(styleElement.sheet?.cssRules, families);
    if (families.size === 0) return;
    const faces: FontFace[] = [];
    document.fonts.forEach((face) => {
      if (families.has(this.unquoted(face.family))) faces.push(face);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, FONT_LOAD_TIMEOUT_MS); });
    await Promise.race([Promise.allSettled(faces.map((face) => face.load())), timeout]);
    clearTimeout(timer);
  }

  private collectFontFamilies(rules: CSSRuleList | undefined, families: Set<string>): void {
    for (const rule of Array.from(rules ?? [])) {
      if (rule instanceof CSSFontFaceRule) families.add(this.unquoted(rule.style.getPropertyValue('font-family')));
      else if (rule instanceof CSSGroupingRule) this.collectFontFamilies(rule.cssRules, families);
    }
  }

  private unquoted(family: string): string {
    return family.trim().replace(/^["']|["']$/g, '');
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
