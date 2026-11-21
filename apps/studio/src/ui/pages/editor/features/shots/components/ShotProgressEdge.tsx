import { useEffect, useRef } from 'react';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';

/** Source time, as the shot holds it. */
interface ShotProgressEdgeProps {
  startSec: number;
  endSec: number;
}

const EDGE_CLASS = 'absolute left-0 right-0 bottom-0 h-[2px] bg-accent origin-left pointer-events-none';

/**
 * How far the playhead is through the shot as the output plays it, so
 * it runs smoothly through a cut, drawn along the card's bottom edge. Written straight to the element on every tick rather
 * than rendered: a card re-rendered sixty times a second would cost
 * more than everything else on the panel.
 */
export function ShotProgressEdge({ startSec, endSec }: ShotProgressEdgeProps) {
  const store = useEditorStore();
  const timeMap = useRenderTimeMap();
  const edgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const paint = () => {
      const edge = edgeRef.current;
      if (!edge) return;
      const outputStartSec = timeMap.toOutputTime(startSec);
      const span = timeMap.toOutputTime(endSec) - outputStartSec;
      const playheadSec = timeMap.toOutputTime(store.snapshot().video.currentTime);
      const through = span > 0 ? (playheadSec - outputStartSec) / span : 0;
      edge.style.transform = `scaleX(${Math.min(1, Math.max(0, through))})`;
    };
    paint();
    store.addEventListener('timechange', paint);
    return () => store.removeEventListener('timechange', paint);
  }, [store, timeMap, startSec, endSec]);

  return <span ref={edgeRef} className={EDGE_CLASS} aria-hidden />;
}
