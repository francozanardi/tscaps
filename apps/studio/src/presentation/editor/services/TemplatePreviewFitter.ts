/** How a preview draws its caption into a card: scaled by `scale` around its centre, then moved by `offsetX` / `offsetY` card pixels. */
export interface PreviewFit {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface PreviewBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const DECORATION_SELECTOR = '.word-decoration';

/**
 * Fits what a preview caption paints into the room a card leaves it,
 * scaling it down to the room and never up.
 *
 * The caption is laid out centred in the card, but an emoji can hang
 * outside its box, under a word or in a row below the caption, where a
 * fit that read only the box would cut it off at the card's edge and
 * leave the rest looking high. So the extent fitted is the box and every
 * emoji in it, and its centre is moved onto the card's.
 *
 * Read from layout, not from what is painted at this instant: an emoji
 * still in its entrance, drawn smaller than it lands, would otherwise
 * be fitted at that smaller size.
 */
export class TemplatePreviewFitter {
  /** `null` while the caption or the room has no size yet. */
  fit(caption: HTMLElement, roomWidth: number, roomHeight: number): PreviewFit | null {
    const width = caption.offsetWidth;
    const height = caption.offsetHeight;
    if (width === 0 || height === 0 || roomWidth <= 0 || roomHeight <= 0) return null;
    const extent = this.paintedExtent(caption, width, height);
    const scale = Math.min(roomWidth / (extent.right - extent.left), roomHeight / (extent.bottom - extent.top), 1);
    return {
      scale,
      offsetX: (width / 2 - (extent.left + extent.right) / 2) * scale,
      offsetY: (height / 2 - (extent.top + extent.bottom) / 2) * scale,
    };
  }

  private paintedExtent(caption: HTMLElement, width: number, height: number): PreviewBox {
    let extent: PreviewBox = { left: 0, top: 0, right: width, bottom: height };
    for (const decoration of caption.querySelectorAll<HTMLElement>(DECORATION_SELECTOR)) {
      const box = this.layoutBoxWithin(decoration, caption);
      extent = {
        left: Math.min(extent.left, box.left),
        top: Math.min(extent.top, box.top),
        right: Math.max(extent.right, box.right),
        bottom: Math.max(extent.bottom, box.bottom),
      };
    }
    return extent;
  }

  // Both offset chains end at the same positioned ancestor, which the
  // caption's own may pass through without stopping, so the box is the
  // difference of the two rather than the element's chain up to it.
  private layoutBoxWithin(element: HTMLElement, caption: HTMLElement): PreviewBox {
    const elementOrigin = this.offsetFromPositionedRoot(element);
    const captionOrigin = this.offsetFromPositionedRoot(caption);
    const left = elementOrigin.left - captionOrigin.left;
    const top = elementOrigin.top - captionOrigin.top;
    return { left, top, right: left + element.offsetWidth, bottom: top + element.offsetHeight };
  }

  private offsetFromPositionedRoot(element: HTMLElement): { left: number; top: number } {
    let left = 0;
    let top = 0;
    let node: Element | null = element;
    while (node instanceof HTMLElement) {
      left += node.offsetLeft;
      top += node.offsetTop;
      node = node.offsetParent;
    }
    return { left, top };
  }
}
