/**
 * How wide an element is laid out, as a multiple of the font size it
 * renders at: its border box where layout put it, before any transform
 * paints it at another size.
 *
 * Transforms are left out because they never move layout. A width read
 * through one changes whenever the transform does while the box stays
 * as it was: a line drawn smaller while another is being said, an
 * entrance that starts scaled down, a caption turned at an angle. A
 * stylesheet sizing text from such a reading answers the transform
 * rather than the text, and whatever watches layout for a change never
 * sees the transform move.
 *
 * An element laid out inline has no width of its own; the extent of its
 * fragments stands in, rounded to whole pixels, which is what layout
 * reports for it. An element that generates no box reads zero.
 */
export class LayoutWidthReader {
  widthEm(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const fontSizePx = parseFloat(style.fontSize) || 0;
    if (fontSizePx <= 0) return 0;
    return this.widthPx(element, style) / fontSizePx;
  }

  private widthPx(element: HTMLElement, style: CSSStyleDeclaration): number {
    // The resolved `width` is the used one, to a fraction of a pixel,
    // for every box that has a width; an inline box resolves to `auto`.
    const width = parseFloat(style.width);
    if (Number.isNaN(width)) return element.offsetWidth;
    if (style.boxSizing === 'border-box') return width;
    return width
      + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  }
}
