import { useEffect, useRef } from 'react';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

const PLAYBACK_CURSOR_CLASS = 'bg-accent';

interface PlaybackCursorProps {
  segmentStartSec: number;
  segmentEndSec: number;
}

/**
 * Vertical line tracking the video playhead inside a segment's
 * timeline. Hidden when the playhead is outside the segment's range.
 * Positioning is written straight to the DOM on every `timechange`
 * tick so playback never triggers a React render of the surrounding
 * row.
 */
export function PlaybackCursor({ segmentStartSec, segmentEndSec }: PlaybackCursorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const store = useEditorStore();

  useEffect(() => {
    const updatePosition = () => {
      const el = ref.current;
      if (!el) return;
      const time = store.snapshot().video.currentTime;
      const duration = segmentEndSec - segmentStartSec;
      if (duration <= 0 || time < segmentStartSec || time > segmentEndSec) {
        el.style.display = 'none';
        return;
      }
      const fraction = (time - segmentStartSec) / duration;
      el.style.display = 'block';
      el.style.left = `${fraction * 100}%`;
    };
    updatePosition();
    store.addEventListener('timechange', updatePosition);
    return () => store.removeEventListener('timechange', updatePosition);
  }, [store, segmentStartSec, segmentEndSec]);

  return (
    <div
      ref={ref}
      className={PLAYBACK_CURSOR_CLASS}
      style={{ position: 'absolute', top: 0, bottom: 0, width: 2, display: 'none' }}
    />
  );
}
