import { useLayoutEffect, type RefObject } from 'react';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

/**
 * Publishes the element's own width on it, as a multiple of the font
 * size it renders at, under `property`.
 *
 * The multiple is what lets a stylesheet size text against the frame.
 * It is free of the size it was read at, so a rule deriving the font
 * size from it settles: the first read publishes the ratio, the rule
 * resizes the text, and the element comes back with the same ratio.
 * Re-publishing stops there because the value has not changed.
 *
 * Watching the box rather than tracking what could have changed it is
 * deliberate — the width moves with the face, the weight, the spacing,
 * the text and the render state, and a dependency list naming all of
 * them goes stale the first time one is added.
 *
 * The width is the one layout gave the box, before any transform. A
 * transform repaints the box without resizing it, so the box never
 * reports it; a reading taken through one would keep whatever size the
 * element happened to be drawn at when the box last resized, and a
 * stylesheet sizing text from it would grow or shrink the text each
 * time the box resized again.
 *
 * This is the preview's own answer to what the engine measures for
 * export against an offline probe. The two paths measure separately,
 * as they already do for the caption's placement, and read each box
 * the same way.
 *
 * `enabled` lets a caller skip an element it is conditionally leaving
 * out of the render. It is a dependency rather than an early return, so
 * a component that flips between rendering its element and not is
 * measuring the element actually mounted rather than one React has
 * since replaced.
 */
export function useMeasuredWidth(
  ref: RefObject<HTMLElement | null>,
  property: string,
  enabled: boolean = true,
): void {
  const { layoutWidthReader } = useEngine();
  useLayoutEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    let published: string | null = null;
    const publish = (): void => {
      const value = String(layoutWidthReader.widthEm(element));
      if (value === published) return;
      published = value;
      element.style.setProperty(property, value);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element, { box: 'border-box' });
    return () => observer.disconnect();
  }, [ref, property, enabled, layoutWidthReader]);
}
