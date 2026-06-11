import type { TextMeasurer } from '@modules/splitting/TextMeasurer';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { LineState } from '@modules/document/LineState';

export interface DomProbeCanvasTextMeasurerParams {
  /** CSS (raw, unscoped). Cascade source for the probe. */
  css: string;
  /** Custom properties to apply on the probe. */
  cssVars: Record<string, string>;
  /** Probe container width in px. Anchors `cqw` resolution without layout. */
  containerWidth: number;
  /** Probe container height in px. Anchors `cqh` resolution without layout. */
  containerHeight: number;
}

type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

interface ResolvedTypography {
  font: string;
  letterSpacingPx: number;
  wordSpacingPx: number;
  paddingX: number;
  marginX: number;
  textTransform: TextTransform;
}

// Probe DOM is persistent and shadow-encapsulated. Re-mounting per call
// would invalidate the document style + layout cache, and the follow-up
// `getComputedStyle` read would force a synchronous flush — the very cost
// this class exists to avoid. The shadow boundary keeps the probe's
// `<style>` rules from matching elements outside the probe subtree.
let _styleEl: HTMLStyleElement | null = null;
let _container: HTMLElement | null = null;
let _word: HTMLElement | null = null;
let _cctx: CanvasRenderingContext2D | null = null;

// Last DOM state actually applied to the probe. A subsequent call that
// matches a tracked value skips the corresponding write — every write
// invalidates the style cache and inflates the next computed-style read.
let _appliedCss: string | null = null;
let _appliedWidth: number | null = null;
let _appliedHeight: number | null = null;
let _appliedCssVars: Map<string, string> = new Map();

// Resolved typography keyed by the `(css, size, cssVars)` signature that
// produced it. Cache hits skip the probe entirely — no DOM writes, no
// `getComputedStyle`, no style flush.
const _typographyCache = new Map<string, ResolvedTypography>();

/**
 * Resolves text width by reading typography from a persistent
 * shadow-encapsulated DOM probe and measuring with Canvas 2D `measureText`.
 * Effects that `measureText` does not natively apply — letter-spacing,
 * word-spacing, padding, margin, `text-transform` — are read from the
 * probe and added analytically.
 *
 * `@font-face` blocks are stripped from `css` before injection: re-applying
 * them resets `document.fonts.status` to 'loading'.
 *
 * Repeated constructions with the same `(css, cssVars, container size)`
 * reuse a previously resolved typography from a module-level cache and
 * touch no DOM.
 */
export class DomProbeCanvasTextMeasurer implements TextMeasurer {
  private readonly _typography: ResolvedTypography;

  constructor(params: DomProbeCanvasTextMeasurerParams) {
    const css = params.css.replace(/@font-face[^{]*\{[^}]*\}/g, '');
    const signature = this.signatureOf(css, params);
    const cached = _typographyCache.get(signature);
    if (cached) {
      this._typography = cached;
      return;
    }
    this._typography = this.probe(css, params);
    _typographyCache.set(signature, this._typography);
  }

  measure(text: string): number {
    const t = this.applyTransform(text, this._typography.textTransform);
    const cctx = this.ensureCanvasContext();
    cctx.font = this._typography.font;
    return (
      cctx.measureText(t).width +
      Math.max(0, t.length - 1) * this._typography.letterSpacingPx +
      this._typography.paddingX +
      this._typography.marginX
    );
  }

  spaceWidth(): number {
    const cctx = this.ensureCanvasContext();
    cctx.font = this._typography.font;
    return cctx.measureText(' ').width + this._typography.wordSpacingPx + this._typography.letterSpacingPx;
  }

  private probe(css: string, params: DomProbeCanvasTextMeasurerParams): ResolvedTypography {
    const probe = this.ensureProbe();
    this.syncContainerSize(probe.container, params.containerWidth, params.containerHeight);
    this.syncCss(css);
    this.syncCssVars(probe.container, params.cssVars);

    const cs = getComputedStyle(probe.word);
    const fontStyle = this.requireValue(cs.fontStyle, 'font-style');
    const fontWeight = this.requireValue(cs.fontWeight, 'font-weight');
    const fontSize = this.requireValue(cs.fontSize, 'font-size');
    const fontFamily = this.requireValue(cs.fontFamily, 'font-family');
    return {
      font: `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`,
      letterSpacingPx: this.parsePx(cs.letterSpacing),
      wordSpacingPx: this.parsePx(cs.wordSpacing),
      paddingX: this.parsePx(cs.paddingLeft) + this.parsePx(cs.paddingRight),
      marginX: this.parsePx(cs.marginLeft) + this.parsePx(cs.marginRight),
      textTransform: this.normalizeTextTransform(cs.textTransform),
    };
  }

  private signatureOf(css: string, params: DomProbeCanvasTextMeasurerParams): string {
    const keys = Object.keys(params.cssVars).sort();
    const cssVarsStr = keys.map((k) => `${k}=${params.cssVars[k]}`).join(';');
    return `${params.containerWidth}x${params.containerHeight}|${cssVarsStr}|${css}`;
  }

  private ensureProbe(): { container: HTMLElement; word: HTMLElement } {
    if (_container && _word) return { container: _container, word: _word };

    const host = document.createElement('div');
    host.style.cssText =
      `position:fixed;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;`;
    const shadow = host.attachShadow({ mode: 'open' });

    _styleEl = document.createElement('style');
    shadow.appendChild(_styleEl);

    _container = document.createElement('div');
    _container.style.cssText = `container-type:size;`;
    this.pinAnimations(_container);

    const segmentEl = document.createElement('div');
    segmentEl.className = Segment.CSS_CLASS;
    this.pinAnimations(segmentEl);

    const lineEl = document.createElement('div');
    lineEl.className = `${Line.CSS_CLASS} ${LineState.NOT_NARRATED_YET}`;
    this.pinAnimations(lineEl);

    _word = document.createElement('span');
    _word.className = `${Word.CSS_CLASS} ${LineState.NOT_NARRATED_YET}`;
    _word.textContent = 'M';
    this.pinAnimations(_word);

    lineEl.appendChild(_word);
    segmentEl.appendChild(lineEl);
    _container.appendChild(segmentEl);
    shadow.appendChild(_container);

    document.body.appendChild(host);
    return { container: _container, word: _word };
  }

  private syncContainerSize(container: HTMLElement, width: number, height: number): void {
    if (width !== _appliedWidth) {
      container.style.width = `${width}px`;
      _appliedWidth = width;
    }
    if (height !== _appliedHeight) {
      container.style.height = `${height}px`;
      _appliedHeight = height;
    }
  }

  private syncCss(css: string): void {
    if (css !== _appliedCss) {
      _styleEl!.textContent = css;
      _appliedCss = css;
    }
  }

  /**
   * Diff the requested cssVars against what was last applied to the probe
   * and write only the deltas. Each `setProperty` invalidates the style
   * cache for the subtree, so writing unchanged values would inflate the
   * next computed-style read for no reason.
   */
  private syncCssVars(container: HTMLElement, cssVars: Record<string, string>): void {
    for (const [k, v] of Object.entries(cssVars)) {
      if (_appliedCssVars.get(k) !== v) {
        container.style.setProperty(k, v);
      }
    }
    for (const k of _appliedCssVars.keys()) {
      if (!(k in cssVars)) {
        container.style.removeProperty(k);
      }
    }
    _appliedCssVars = new Map(Object.entries(cssVars));
  }

  private ensureCanvasContext(): CanvasRenderingContext2D {
    if (!_cctx) {
      _cctx = document.createElement('canvas').getContext('2d')!;
    }
    return _cctx;
  }

  /**
   * Freeze the element at its final keyframe so the read reflects the
   * resting layout. Without this, computed style for any animated
   * layout-affecting property (font-size, letter-spacing, padding…)
   * lands at the `0%` state.
   */
  private pinAnimations(el: HTMLElement): void {
    el.style.animationPlayState = 'paused';
    el.style.animationDelay = '-1000s';
    el.style.animationFillMode = 'both';
  }

  private requireValue(value: string, propertyName: string): string {
    if (!value) {
      throw new Error(
        `DomProbeCanvasTextMeasurer: getComputedStyle returned empty ${propertyName} on the probe word — typography cannot be resolved.`,
      );
    }
    return value;
  }

  private parsePx(value: string): number {
    if (!value || value === 'normal') return 0;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeTextTransform(value: string): TextTransform {
    if (value === 'uppercase' || value === 'lowercase' || value === 'capitalize') return value;
    return 'none';
  }

  private applyTransform(text: string, t: TextTransform): string {
    switch (t) {
      case 'uppercase': return text.toUpperCase();
      case 'lowercase': return text.toLowerCase();
      case 'capitalize': return text.replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
      default: return text;
    }
  }
}
