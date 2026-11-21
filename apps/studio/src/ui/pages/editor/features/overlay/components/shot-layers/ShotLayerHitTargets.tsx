import { memo, useCallback, useSyncExternalStore, type PointerEvent } from 'react';
import type { ShotLayerHitTarget } from '@presentation/shots/services/ShotLayerHitTargetResolver';
import { useShotLayerOverlay } from '@ui/pages/editor/features/overlay/contexts/ShotLayerOverlayContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { shotLayerRectStyle } from '@ui/pages/editor/features/overlay/shotLayerRectStyle';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';

const LABELS = new ShotLayerLabels();

interface ShotLayerHitTargetsProps {
  /** The overlay scaler, which covers the frame exactly and is what a drag is measured against. */
  scaler: HTMLElement | null;
}

/**
 * One invisible press surface per box over the video on screen, laid
 * exactly over where the preview draws it, bottom to top.
 *
 * Mounted below every caption hitzone: captions are drawn above the
 * footage, so a press on a caption inside a box still picks the
 * caption, and a press on the box anywhere else picks the box. A press
 * picks it and can drag it; the click that follows a press without a
 * drag is the scaler's, which opens the box's panel.
 *
 * A box whose own CSS sets its position shows the not-allowed cursor,
 * and the pointer resting on it tells the manipulation controller,
 * which says why nothing will move.
 *
 * Carries `data-tscaps-shot-layer-id`, which is what the selection
 * resolves a click with and what keeps a press here from reading as a
 * click on empty space.
 */
export const ShotLayerHitTargets = memo(function ShotLayerHitTargets({ scaler }: ShotLayerHitTargetsProps) {
  const { hitTargets } = useShotLayerOverlay();
  const subscribe = useCallback((notify: () => void) => hitTargets.subscribe(notify), [hitTargets]);
  const targets = useSyncExternalStore(subscribe, () => hitTargets.snapshot());
  return (
    <>
      {targets.map((target) => <ShotLayerHitTargetView key={target.layerId} target={target} scaler={scaler} />)}
    </>
  );
});

function ShotLayerHitTargetView({ target, scaler }: { target: ShotLayerHitTarget; scaler: HTMLElement | null }) {
  const { manipulation } = useShotLayerOverlay();
  const catalog = useMediaAssets();
  const media = target.mediaId === null ? null : catalog.get(target.mediaId);
  const label = LABELS.labelOf(target.kind);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!scaler) return;
    manipulation.startMove(target, { frameRect: scaler.getBoundingClientRect(), event: event.nativeEvent });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!scaler) return;
    manipulation.pointAt(target, 'move', { frameRect: scaler.getBoundingClientRect(), clientX: event.clientX, clientY: event.clientY });
  };
  const cssOwned = target.cssOwnedGestures.has('move');
  return (
    <div
      className={`subtitle-overlay-shot-layer-hitzone${cssOwned ? ' is-css-owned' : ''}`}
      data-tscaps-shot-layer-id={target.layerId}
      role="button"
      tabIndex={-1}
      aria-label={target.mediaId === null ? label : `${label}: ${media?.fileName ?? 'deleted file'}`}
      style={shotLayerRectStyle(target.rect)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => manipulation.pointerLeft(target.layerId, 'move')}
    />
  );
}
