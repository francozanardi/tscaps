import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { usePersistentVideoFrame } from '@ui/pages/editor/features/overlay/components/video-frame/PersistentVideoFrameProvider';

const SLOT_STYLE: CSSProperties = { display: 'contents' };

/**
 * Slot that hosts the overlay-level persistent `<video>` element for
 * the lifetime of this segment. Reparenting happens in
 * `useLayoutEffect` so the browser never paints with the slot empty
 * during a segment swap.
 */
export function VideoFrameLayer() {
  const persistent = usePersistentVideoFrame();
  const slotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot || !persistent) return;
    slot.appendChild(persistent.element);
    return () => { persistent.park(); };
  }, [persistent]);

  return <div ref={slotRef} style={SLOT_STYLE} aria-hidden />;
}
