import { memo, useCallback, useSyncExternalStore, type CSSProperties } from 'react';
import { Code2 } from 'lucide-react';
import type { ShotLayerGesture } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import { useShotLayerOverlay } from '@ui/pages/editor/features/overlay/contexts/ShotLayerOverlayContext';

const TEXT_BY_GESTURE: Readonly<Record<ShotLayerGesture, string>> = {
  move: "Position is set in this layer's CSS",
  resize: "Size is set in this layer's CSS",
};

// Past this share of the frame's height the hint would run off its
// bottom edge, so it sits above the pointer instead.
const ABOVE_PAST_Y = 0.88;

/**
 * Says, beside the pointer, why a box over the video will not move or
 * resize: the layer's own CSS sets what the gesture would write. Shown
 * while the manipulation controller publishes a refusal, at the point
 * it gives, and nowhere else.
 */
export const ShotLayerGestureRefusalHint = memo(function ShotLayerGestureRefusalHint() {
  const { manipulation } = useShotLayerOverlay();
  const subscribe = useCallback((notify: () => void) => manipulation.subscribe(notify), [manipulation]);
  const refusal = useSyncExternalStore(subscribe, () => manipulation.refusalSnapshot());
  if (refusal === null) return null;
  const style = { left: `${refusal.x * 100}%`, top: `${refusal.y * 100}%`, '--refusal-x': refusal.x } as CSSProperties;
  return (
    <div
      className={`subtitle-overlay-shot-layer-refusal${refusal.y > ABOVE_PAST_Y ? ' is-above' : ''}`}
      role="status"
      style={style}
    >
      <Code2 size={12} aria-hidden />
      {TEXT_BY_GESTURE[refusal.gesture]}
    </div>
  );
});
