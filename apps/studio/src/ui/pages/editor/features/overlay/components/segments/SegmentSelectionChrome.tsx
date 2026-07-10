import { memo, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import { ManipulationHandles } from '@ui/pages/editor/features/overlay/components/segments/ManipulationHandles';
import { SegmentRotateHandle } from '@ui/pages/editor/features/overlay/components/segments/SegmentRotateHandle';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

interface SegmentSelectionChromeProps {
  segmentId: string;
  sheet: Sheet;
  segmentOverrides: SegmentOverrides;
  /** Behind-actor state variables currently applied to the segment's wrapper. Only read as a re-measure signal — a change means the wrapper's lift moved the hitzone. */
  behindActorVars: Readonly<Record<string, string>>;
  /** The overlay scaler the chrome is measured against and mounted in. */
  containerRef: RefObject<HTMLElement>;
  variant: 'selected' | 'drop-target';
}

/**
 * Segment chrome (selection stroke / drop-target cue, plus the resize
 * and rotate handles when selected) drawn as a ghost box at the scaler
 * level instead of inside the segment hitzone. It cannot live in the
 * segment subtree: the actor-cutout canvas paints above the caption
 * layers, and the scaler's `container-type` makes it a stacking
 * context — no z-index inside the segment tree can cross the cutout.
 * Mounted after the cutout, the chrome wins by tree order.
 *
 * Geometry: the box takes the hitzone's layout size, is centered on
 * the hitzone's viewport center (the AABB center is rotation-invariant,
 * so it matches the wrapper's `transform-origin: center`), and applies
 * the segment's rotation itself. Wrapper-level offsets such as the
 * behind-actor lift are already part of the measured center.
 *
 * Re-measures on selection/style/override changes, on drag ticks, and
 * on hitzone/scaler resize. Like the previous hitzone chrome, it does
 * not track per-frame template animation of `.segment`.
 */
export const SegmentSelectionChrome = memo(function SegmentSelectionChrome({
  segmentId,
  sheet,
  segmentOverrides,
  behindActorVars,
  containerRef,
  variant,
}: SegmentSelectionChromeProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragState = useOverlayDragState();

  const supportsRotation = sheet.template.features.rotation.segment;
  const liveRotationDeg = dragState?.kind === 'segment-rotate' && dragState.segmentId === segmentId
    ? dragState.rotationDeg
    : null;
  const rotationDeg = supportsRotation
    ? liveRotationDeg ?? segmentOverrides.getStyle(segmentId).rotation ?? sheet.rotationConfig.angleDeg
    : 0;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const scaler = containerRef.current;
    if (!box || !scaler) return;
    const reposition = () => repositionChrome(box, scaler, segmentId);
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(scaler);
    const hitzone = findHitzone(scaler, segmentId);
    if (hitzone) observer.observe(hitzone);
    return () => observer.disconnect();
    // `sheet`, `segmentOverrides` and `behindActorVars` re-run the measure
    // whenever alignment, style or lift state changes under the chrome.
  }, [segmentId, sheet, segmentOverrides, behindActorVars, containerRef]);

  // Re-measure on every drag-state tick: segment move/resize/rotate
  // gestures reshape the hitzone continuously between React commits.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const scaler = containerRef.current;
    if (!box || !scaler) return;
    repositionChrome(box, scaler, segmentId);
  }, [dragState, segmentId, containerRef]);

  const variantClass = variant === 'selected' ? 'is-selected' : 'is-drop-target';
  return (
    <div
      ref={boxRef}
      className={`subtitle-overlay-segment-chrome ${variantClass}`}
      style={{ transform: `rotate(${rotationDeg}deg)` }}
      aria-hidden
    >
      {variant === 'selected' && <ManipulationHandles segmentId={segmentId} />}
      {variant === 'selected' && supportsRotation && <SegmentRotateHandle segmentId={segmentId} />}
    </div>
  );
});

function findHitzone(scaler: HTMLElement, segmentId: string): HTMLElement | null {
  const element = scaler.querySelector(`[data-tscaps-segment-id="${CSS.escape(segmentId)}"]`);
  return element instanceof HTMLElement ? element : null;
}

function repositionChrome(
  box: HTMLDivElement,
  scaler: HTMLElement,
  segmentId: string,
): void {
  const hitzone = findHitzone(scaler, segmentId);
  if (!hitzone) {
    box.style.visibility = 'hidden';
    return;
  }
  // offset* is the transform-free layout size; the client rect center is
  // rotation-invariant, so together they reconstruct the unrotated box.
  const width = hitzone.offsetWidth;
  const height = hitzone.offsetHeight;
  const scalerBox = scaler.getBoundingClientRect();
  const hitzoneBox = hitzone.getBoundingClientRect();
  const centerX = hitzoneBox.left + hitzoneBox.width / 2 - scalerBox.left;
  const centerY = hitzoneBox.top + hitzoneBox.height / 2 - scalerBox.top;
  box.style.visibility = 'visible';
  box.style.left = `${centerX - width / 2}px`;
  box.style.top = `${centerY - height / 2}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}
