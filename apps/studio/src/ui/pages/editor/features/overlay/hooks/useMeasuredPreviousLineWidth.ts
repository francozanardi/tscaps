import { useLayoutEffect, type RefObject } from 'react';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

/**
 * Publishes, on a line, the width of the line above it in the same
 * segment, as a multiple of the font size that line renders at, under
 * `property`. Nothing is published when `previousLineId` is `null` or
 * that line is not mounted.
 *
 * The sibling is watched rather than read once, because its width moves
 * with everything that restyles it, and the line carrying the value is
 * the one a stylesheet lines up against it.
 *
 * The width is the one layout gave the sibling, before any transform,
 * read as the export reads it.
 *
 * The preview's own answer to what the engine publishes for export.
 */
export function useMeasuredPreviousLineWidth(
  ref: RefObject<HTMLElement | null>,
  previousLineId: string | null,
  property: string,
): void {
  const { layoutWidthReader } = useEngine();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || previousLineId === null) return;
    const previous = element.parentElement?.querySelector<HTMLElement>(
      `:scope > [${CAPTION_ELEMENT_ID_ATTRIBUTE}="${CSS.escape(previousLineId)}"]`,
    );
    if (!previous) return;

    let published: string | null = null;
    const publish = (): void => {
      const value = String(layoutWidthReader.widthEm(previous));
      if (value === published) return;
      published = value;
      element.style.setProperty(property, value);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(previous, { box: 'border-box' });
    return () => {
      observer.disconnect();
      element.style.removeProperty(property);
    };
  }, [ref, previousLineId, property, layoutWidthReader]);
}
