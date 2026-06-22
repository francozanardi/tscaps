import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Segment, Line, Word, Decoration } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useOverlayController } from '@ui/pages/editor/features/overlay/contexts/OverlayControllerContext';

/**
 * Returns a ref to attach to the word's outer element. The overlay
 * controller writes the word's time-driven className and CSS
 * variables on this element, both on mount and on every playback
 * tick. React must not set `className` on this element — the
 * controller owns it. `segment` and `indexInLine` supply the ancestor
 * context the engine needs to compute the word's timing variables.
 */
export function useBoundWord(
  word: Word,
  segment: Segment,
  indexInLine: number,
): RefObject<HTMLSpanElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return controller.bindWord(el, word, segment, indexInLine);
  }, [controller, word, segment, indexInLine]);
  return ref;
}

/**
 * Returns a ref to attach to the line's outer element. See
 * `useBoundWord` for the contract. The optional `enabled` flag lets a
 * caller skip the binding when the line is conditionally omitted from
 * the render — the same component instance can flip between rendering
 * the line and not, and the binding follows the actual mounted element
 * across that transition. `segment` supplies the owning-segment time
 * window the line publishes as its timing variables.
 */
export function useBoundLine(
  line: Line,
  segment: Segment,
  enabled: boolean = true,
): RefObject<HTMLDivElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    return controller.bindLine(el, line, segment);
  }, [controller, line, segment, enabled]);
  return ref;
}

/**
 * Returns a ref to attach to the segment's outer element. See
 * `useBoundWord` for the contract. `indexInSection` supplies the
 * position the segment publishes as `--segment-index`.
 */
export function useBoundSegment(
  segment: Segment,
  indexInSection: number,
): RefObject<HTMLDivElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return controller.bindSegment(el, segment, indexInSection);
  }, [controller, segment, indexInSection]);
  return ref;
}

/**
 * Returns a ref to attach to the decoration's outer element. The
 * controller writes the decoration's time-driven CSS variables on
 * this element on every tick — same contract as `useBoundWord`.
 * `segment` and `word` supply the ancestor windows the decoration
 * falls back to when it carries no `customTime`.
 */
export function useBoundDecoration(
  decoration: Decoration,
  segment: Segment,
  word: Word,
): RefObject<HTMLSpanElement> {
  const controller = useOverlayController();
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return controller.bindDecoration(el, decoration, segment, word);
  }, [controller, decoration, segment, word]);
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
