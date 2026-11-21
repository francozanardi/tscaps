import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useRetainedValue } from '@ui/_shared/hooks/useRetainedValue';

// The shot's edges are kept this far inside, past whatever a cut leaves on an edge frame.
const EDGE_SEC = 0.1;
// How long the playhead rests before the frame follows it, so a scrub reads one frame rather than every one it crosses.
const SETTLE_MS = 150;

/**
 * The moment of the source a shot's *Camera* tab shows the frame of, between
 * `startSec` and `endSec` of the source: the playhead's while it is in
 * the shot, the edge of the shot nearest to it otherwise. It follows the
 * playhead once the playhead rests, and holds still while the video plays.
 * Where the preview plays the source rather than a proxy, it stays on
 * the shot's start: each frame would then be decoded from the source,
 * which for a 4K video costs a third of a second and a long task on the
 * main thread, on the phones that play the source because it is too big
 * for them.
 */
export function useShotMoment(startSec: number, endSec: number): number {
  const store = useEditorStore();
  const subscribe = useCallback((onChange: () => void) => {
    store.addEventListener('timechange', onChange);
    store.addEventListener('change', onChange);
    return () => {
      store.removeEventListener('timechange', onChange);
      store.removeEventListener('change', onChange);
    };
  }, [store]);
  const getSnapshot = useCallback(() => {
    const { video } = store.snapshot();
    // Clamped to the shot's start below.
    if (video.preview?.kind !== 'proxy') return Number.NEGATIVE_INFINITY;
    return video.isPlaying ? null : video.currentTime;
  }, [store]);
  const resting = useRetainedValue(useSyncExternalStore(subscribe, getSnapshot));
  const first = startSec + EDGE_SEC;
  const last = Math.max(first, endSec - EDGE_SEC);
  const asked = Math.round(Math.min(last, Math.max(first, resting ?? first)) * 1000) / 1000;
  const [shown, setShown] = useState(asked);
  useEffect(() => {
    const settling = setTimeout(() => setShown(asked), SETTLE_MS);
    return () => clearTimeout(settling);
  }, [asked]);
  // A shot changed under it shows its own edge at once, not the last shot's moment.
  return Math.min(last, Math.max(first, shown));
}
