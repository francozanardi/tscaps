import type { WordEdgeReader, WordEdges } from '@modules/splitting/WordEdgeReader';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { LineState } from '@modules/document/LineState';
import { StructureTag } from '@modules/tags/StructureTag';

export interface DomProbeWordEdgeReaderParams {
  /** CSS (raw, unscoped). Cascade source for the probe. */
  css: string;
  /** Custom properties to apply on the probe. */
  cssVars: Record<string, string>;
  /** Probe container width in px. Anchors `cqw` resolution without layout. */
  containerWidth: number;
  /** Probe container height in px. Anchors `cqh` resolution without layout. */
  containerHeight: number;
}

interface ProbeTypography {
  readonly font: string;
  readonly fontSizePx: number;
  readonly textTransform: string;
}

interface GlyphReach {
  readonly ascentPx: number;
  readonly descentPx: number;
}

// One probe for the whole page, kept mounted: mounting one per derivation
// would invalidate the document's style cache every time, and the computed
// style read that follows would force the flush this exists to avoid. The
// shadow root keeps the probe's rules away from the page.
let _styleElement: HTMLStyleElement | null = null;
let _container: HTMLElement | null = null;
let _segment: HTMLElement | null = null;
let _liftedWord: HTMLElement | null = null;
let _canvasContext: CanvasRenderingContext2D | null = null;
const _requestedFonts = new Set<string>();

const LETTER = /[\p{L}\p{N}]/u;

/**
 * Reads a word's edges in the font it would be drawn in as the lifted word
 * of its segment: the stylesheet is applied to a probe caption of three
 * lines, the middle one lifted, carrying the segment's own classes, so a
 * rule that restyles the lifted word by its place or by the caption's
 * classes reaches the probe too. Each letter's reach above and below the
 * baseline comes from canvas `measureText` in that font, every mark it
 * carries included (the dot of an `i`, an accent). An edge's spread runs
 * from the letter that ends nearest the baseline to the glyph that ends
 * furthest from it, a punctuation mark included: a `?` rising past short
 * letters leaves the same hole above them a capital would, while a period,
 * lower than every letter, says nothing about where the letters end.
 *
 * Fast enough to run on every derivation: the font is resolved once per
 * set of classes, and a letter is measured once per font. A face not yet
 * loaded is measured as the browser's fallback and asked to load, so a
 * derivation that runs again once it arrives reads the real one.
 *
 * Answers `null` outside a browser, or for a word with no letter.
 */
export class DomProbeWordEdgeReader implements WordEdgeReader {
  private readonly css: string;
  private readonly typographyByClasses = new Map<string, ProbeTypography>();
  private readonly reachByGlyph = new Map<string, GlyphReach>();
  private readonly graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  constructor(private readonly params: DomProbeWordEdgeReaderParams) {
    this.css = params.css.replace(/@font-face[^{]*\{[^}]*\}/g, '');
  }

  edgesOf(word: Word, segment: Segment): WordEdges | null {
    if (typeof document === 'undefined') return null;
    const typography = this.typographyFor(segment, word);
    const glyphs = this.visibleGlyphsOf(this.transformedCase(word.displayText, typography.textTransform));
    const letters = glyphs.filter((glyph) => LETTER.test(glyph)).map((glyph) => this.reachOf(glyph, typography.font));
    const all = glyphs.map((glyph) => this.reachOf(glyph, typography.font));
    if (letters.length === 0 || typography.fontSizePx <= 0) return null;
    return {
      topSpreadEm: this.spread(letters.map((reach) => reach.ascentPx), all.map((reach) => reach.ascentPx)) / typography.fontSizePx,
      bottomSpreadEm: this.spread(letters.map((reach) => reach.descentPx), all.map((reach) => reach.descentPx)) / typography.fontSizePx,
    };
  }

  private typographyFor(segment: Segment, word: Word): ProbeTypography {
    const segmentClasses = [...segment.structureTags].map((tag) => tag.toCssClass());
    const wordClasses = word.getTagCssClasses();
    const key = `${segmentClasses.sort().join('.')}|${[...wordClasses].sort().join('.')}`;
    let typography = this.typographyByClasses.get(key);
    if (!typography) {
      typography = this.probe(segmentClasses, wordClasses);
      this.typographyByClasses.set(key, typography);
    }
    return typography;
  }

  private probe(segmentClasses: ReadonlyArray<string>, wordClasses: ReadonlyArray<string>): ProbeTypography {
    this.ensureProbe();
    this.syncProbe();
    _segment!.className = [Segment.CSS_CLASS, ...segmentClasses].join(' ');
    _liftedWord!.className = [Word.CSS_CLASS, LineState.NOT_NARRATED_YET, ...wordClasses].join(' ');
    const style = getComputedStyle(_liftedWord!);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    this.requestFontLoad(font);
    return { font, fontSizePx: parseFloat(style.fontSize) || 0, textTransform: style.textTransform };
  }

  private reachOf(letter: string, font: string): GlyphReach {
    const key = `${font}|${letter}`;
    let reach = this.reachByGlyph.get(key);
    if (!reach) {
      const context = this.canvasContext();
      context.font = font;
      const metrics = context.measureText(letter);
      reach = { ascentPx: metrics.actualBoundingBoxAscent, descentPx: metrics.actualBoundingBoxDescent };
      this.reachByGlyph.set(key, reach);
    }
    return reach;
  }

  private visibleGlyphsOf(text: string): string[] {
    return [...this.graphemes.segment(text)].map((part) => part.segment).filter((grapheme) => grapheme.trim() !== '');
  }

  /** From the letter nearest the baseline to the glyph furthest from it. */
  private spread(letterReaches: ReadonlyArray<number>, glyphReaches: ReadonlyArray<number>): number {
    return Math.max(...glyphReaches) - Math.min(...letterReaches);
  }


  private transformedCase(text: string, textTransform: string): string {
    if (textTransform === 'uppercase') return text.toUpperCase();
    if (textTransform === 'lowercase') return text.toLowerCase();
    if (textTransform === 'capitalize') return text.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
    return text;
  }

  /** Asks the browser for the face once, so a measurement taken on the fallback is not the last one. */
  private requestFontLoad(font: string): void {
    if (_requestedFonts.has(font) || !document.fonts) return;
    _requestedFonts.add(font);
    // Best effort: a face that fails to load leaves the fallback measured, as it is drawn.
    document.fonts.load(font).catch(() => undefined);
  }

  private syncProbe(): void {
    if (_styleElement!.textContent !== this.css) _styleElement!.textContent = this.css;
    _container!.style.width = `${this.params.containerWidth}px`;
    _container!.style.height = `${this.params.containerHeight}px`;
    const style = _container!.style;
    for (const property of [...style]) {
      if (property.startsWith('--') && !(property in this.params.cssVars)) style.removeProperty(property);
    }
    for (const [property, value] of Object.entries(this.params.cssVars)) {
      if (style.getPropertyValue(property) !== value) style.setProperty(property, value);
    }
  }

  private ensureProbe(): void {
    if (_container) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    _styleElement = document.createElement('style');
    _container = document.createElement('div');
    _container.style.cssText = 'container-type:size;';
    _segment = this.pinned(document.createElement('div'));
    const before = this.lineOf(StructureTag.FIRST_LINE_IN_SEGMENT);
    const lifted = this.lineOf(StructureTag.ISOLATED_LINE);
    const after = this.lineOf(StructureTag.LAST_LINE_IN_SEGMENT);
    _liftedWord = lifted.firstElementChild as HTMLElement;
    _segment.append(before, lifted, after);
    _container.appendChild(_segment);
    shadow.append(_styleElement, _container);
    document.body.appendChild(host);
  }

  private lineOf(structureClass: string): HTMLElement {
    const line = this.pinned(document.createElement('div'));
    line.className = `${Line.CSS_CLASS} ${LineState.NOT_NARRATED_YET} ${structureClass}`;
    const word = this.pinned(document.createElement('span'));
    word.className = `${Word.CSS_CLASS} ${LineState.NOT_NARRATED_YET}`;
    word.textContent = 'M';
    line.appendChild(word);
    return line;
  }

  /** Frozen at the end of every animation, so the style read is the resting one. */
  private pinned(element: HTMLElement): HTMLElement {
    element.style.animationPlayState = 'paused';
    element.style.animationDelay = '-1000s';
    element.style.animationFillMode = 'both';
    return element;
  }

  private canvasContext(): CanvasRenderingContext2D {
    if (!_canvasContext) _canvasContext = document.createElement('canvas').getContext('2d')!;
    return _canvasContext;
  }
}
