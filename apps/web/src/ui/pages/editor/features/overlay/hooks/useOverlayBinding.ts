import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Segment, Line, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useOverlayController } from '@ui/pages/editor/features/overlay/contexts/OverlayControllerContext';

/**
 * Returns a ref to attach to the word's outer element. The overlay
 * controller writes the word's time-driven className and CSS
 * variables on this element, both on mount and on every playback
 * tick. React must not set `className` on this element — the
 * controller owns it.
 */
export function useBoundWord(word: Word): RefObject<HTMLSpanElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return controller.bindWord(el, word);
  }, [controller, word]);
  return ref;
}

/**
 * Returns a ref to attach to the line's outer element. See
 * `useBoundWord` for the contract. The optional `enabled` flag lets a
 * caller skip the binding when the line is conditionally omitted from
 * the render — the same component instance can flip between rendering
 * the line and not, and the binding follows the actual mounted element
 * across that transition.
 */
export function useBoundLine(line: Line, enabled: boolean = true): RefObject<HTMLDivElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    return controller.bindLine(el, line);
  }, [controller, line, enabled]);
  return ref;
}

/**
 * Returns a ref to attach to the segment's outer element. See
 * `useBoundWord` for the contract.
 */
export function useBoundSegment(segment: Segment): RefObject<HTMLDivElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return controller.bindSegment(el, segment);
  }, [controller, segment]);
  return ref;
}

/**
 * Returns a ref to attach to the `<g>` that hosts a sheet's
 * materialized `<filter>` defs. The controller writes the `<g>`'s
 * inner HTML on every tick.
 */
export function useBoundSheetFilterDefs(sheet: Sheet): RefObject<SVGGElement> {
  const controller = useOverlayController();
  const ref = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return controller.bindSheetFilterDefs(el, sheet);
  }, [controller, sheet]);
  return ref;
}
