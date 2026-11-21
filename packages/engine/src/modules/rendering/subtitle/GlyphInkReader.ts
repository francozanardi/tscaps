/** How far glyphs reach from their baseline, as multiples of a font size. */
export interface GlyphInkExtents {
  /** Height of the tallest glyph above the baseline. */
  readonly ascentEm: number;
  /** Depth of the deepest glyph below the baseline. */
  readonly descentEm: number;
}

/**
 * How far an element's text reaches above and below its baseline, ink
 * rather than box: a word of short letters ("run") reaches the x-height,
 * one with a capital or an ascender reaches higher, and one with a
 * descender reaches below the baseline. The answer is in multiples of the
 * element's own font size, so it holds whatever size the element is laid
 * out at.
 *
 * Every text inside the element is measured in the font it is drawn in,
 * its case transformed as its style asks; the tallest and the deepest
 * glyph answer. Measured on a canvas, which draws the same font files as
 * the page but knows nothing of a variable font's optical size, so a face
 * whose shapes change with its size answers for its default one.
 *
 * Answers `null` when the element has no text, no font size, or the
 * browser offers no canvas to measure on.
 */
export class GlyphInkReader {
  private context: CanvasRenderingContext2D | null | undefined;

  extentsEm(element: HTMLElement): GlyphInkExtents | null {
    const fontSizePx = parseFloat(window.getComputedStyle(element).fontSize);
    if (!(fontSizePx > 0)) return null;
    const context = this.canvasContext();
    if (!context) return null;

    let ascentPx = 0;
    let descentPx = 0;
    let measured = false;
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const owner = node.parentElement;
      if (!text || !owner) continue;
      const style = window.getComputedStyle(owner);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText(this.transformedCase(text, style.textTransform));
      ascentPx = Math.max(ascentPx, metrics.actualBoundingBoxAscent);
      descentPx = Math.max(descentPx, metrics.actualBoundingBoxDescent);
      measured = true;
    }
    if (!measured) return null;
    return { ascentEm: ascentPx / fontSizePx, descentEm: descentPx / fontSizePx };
  }

  private transformedCase(text: string, textTransform: string): string {
    if (textTransform === 'uppercase') return text.toUpperCase();
    if (textTransform === 'lowercase') return text.toLowerCase();
    if (textTransform === 'capitalize') return text.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
    return text;
  }

  private canvasContext(): CanvasRenderingContext2D | null {
    if (this.context === undefined) {
      this.context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    }
    return this.context;
  }
}
