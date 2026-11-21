import { memo, useCallback, useSyncExternalStore, type MouseEvent, type PointerEvent } from 'react';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import type { ShotLayerHitTarget } from '@presentation/shots/services/ShotLayerHitTargetResolver';
import { useShotLayerOverlay } from '@ui/pages/editor/features/overlay/contexts/ShotLayerOverlayContext';
import { shotLayerRectStyle } from '@ui/pages/editor/features/overlay/shotLayerRectStyle';

interface ShotLayerSelectionChromeProps {
  selectionController: OverlaySelectionController;
  /** The overlay scaler, which covers the frame exactly and is what a resize is measured against. */
  scaler: HTMLElement | null;
}

const CORNERS: ReadonlyArray<{ corner: ResizeCorner; label: string }> = [
  { corner: 'tl', label: 'Resize from the top left corner' },
  { corner: 'tr', label: 'Resize from the top right corner' },
  { corner: 'bl', label: 'Resize from the bottom left corner' },
  { corner: 'br', label: 'Resize from the bottom right corner' },
];

/**
 * The picked box over the video, drawn: its outline and a resize
 * handle on each corner, and the frame's centre lines while it is being
 * moved, lit when its centre sits on them.
 *
 * Mounted after the captions and the actor cutout, with the rest of the
 * selection chrome, so nothing covers the handles. Only a box has any:
 * a full-screen or split layer is picked from its shot and edited in
 * its panel. Drawn while the box is on screen, from the same rect the
 * hit target takes, which is the rect the preview draws.
 *
 * A handle whose resize the box's own CSS has taken over shows the
 * not-allowed cursor and starts nothing; the pointer resting on it
 * tells the manipulation controller, which says why.
 *
 * Several layers picked together each draw their outline while on
 * screen, with no handles: a drag moves one box, so pressing one of
 * them picks it alone.
 */
export const ShotLayerSelectionChrome = memo(function ShotLayerSelectionChrome({
  selectionController, scaler,
}: ShotLayerSelectionChromeProps) {
  const { hitTargets, manipulation } = useShotLayerOverlay();
  const subscribeToSelection = useCallback((notify: () => void) => selectionController.subscribe(notify), [selectionController]);
  const picked = useSyncExternalStore(subscribeToSelection, () => selectionController.paintedSelectionSnapshot());
  const subscribeToTargets = useCallback((notify: () => void) => hitTargets.subscribe(notify), [hitTargets]);
  const targets = useSyncExternalStore(subscribeToTargets, () => hitTargets.snapshot());
  const subscribeToDrag = useCallback((notify: () => void) => manipulation.subscribe(notify), [manipulation]);
  const drag = useSyncExternalStore(subscribeToDrag, () => manipulation.snapshot());

  if (picked?.kind === 'shot-layers') {
    return (
      <>
        {targets.filter((candidate) => picked.layerIds.includes(candidate.layerId)).map((candidate) => (
          <div key={candidate.layerId} className="subtitle-overlay-shot-layer-chrome" style={shotLayerRectStyle(candidate.rect)} />
        ))}
      </>
    );
  }
  const target = picked?.kind === 'shot-layer'
    ? targets.find((candidate) => candidate.layerId === picked.layerId) ?? null
    : null;
  if (!target) return null;
  const isMoving = drag?.layerId === target.layerId && drag.gesture === 'move';
  return (
    <>
      {isMoving && (
        <div className="subtitle-overlay-snap-guides" aria-hidden>
          <div className={guideClass('vertical', drag.snappedToVerticalCentre)} style={{ left: '50%' }} />
          <div className={guideClass('horizontal', drag.snappedToHorizontalCentre)} style={{ top: '50%' }} />
        </div>
      )}
      <div className="subtitle-overlay-shot-layer-chrome" style={shotLayerRectStyle(target.rect)}>
        {CORNERS.map(({ corner, label }) => (
          <ResizeHandle key={corner} corner={corner} label={label} target={target} scaler={scaler} />
        ))}
      </div>
    </>
  );
});

function ResizeHandle({ corner, label, target, scaler }: {
  corner: ResizeCorner;
  label: string;
  target: ShotLayerHitTarget;
  scaler: HTMLElement | null;
}) {
  const { manipulation } = useShotLayerOverlay();
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!scaler) return;
    manipulation.startResize(target, corner, { frameRect: scaler.getBoundingClientRect(), event: event.nativeEvent });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!scaler) return;
    manipulation.pointAt(target, 'resize', { frameRect: scaler.getBoundingClientRect(), clientX: event.clientX, clientY: event.clientY });
  };
  const cssOwned = target.cssOwnedGestures.has('resize');
  return (
    <div
      className={`subtitle-overlay-shot-layer-handle subtitle-overlay-shot-layer-handle-${corner}${cssOwned ? ' is-css-owned' : ''}`}
      data-tscaps-shot-layer-id={target.layerId}
      role="button"
      aria-label={label}
      aria-disabled={cssOwned || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => manipulation.pointerLeft(target.layerId, 'resize')}
      onClick={swallowClick}
    />
  );
}

// A press on a handle is a resize, never a pick: the box is already the
// one picked, and a click reaching the scaler would open its panel.
function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}

function guideClass(direction: 'vertical' | 'horizontal', active: boolean): string {
  return `subtitle-overlay-snap-guide subtitle-overlay-snap-guide-${direction}${active ? ' is-active' : ''}`;
}
