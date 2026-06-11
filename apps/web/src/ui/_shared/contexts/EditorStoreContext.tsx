import { createContext, useCallback, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';

const EditorStoreContext = createContext<EditorStore | null>(null);

interface EditorStoreProviderProps {
  value: EditorStore;
  children: ReactNode;
}

export function EditorStoreProvider({ value, children }: EditorStoreProviderProps) {
  return <EditorStoreContext.Provider value={value}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('useEditorStore must be used inside <EditorStoreProvider>');
  return store;
}

/**
 * Current playback time in seconds. Re-renders on every tick — keep
 * the consumer's render body cheap.
 */
export function useVideoTime(): number {
  const store = useEditorStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('timechange', cb);
    return () => store.removeEventListener('timechange', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.snapshot().video.currentTime, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Id of the segment active at the current playback time, falling
 * back to the most recently played segment when nothing is active.
 * Re-renders only when the id itself changes.
 */
export function useActiveSegmentId(): string | null {
  const store = useEditorStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('timechange', cb);
    store.addEventListener('change', cb);
    return () => {
      store.removeEventListener('timechange', cb);
      store.removeEventListener('change', cb);
    };
  }, [store]);
  const getSnapshot = useCallback(() => deriveActiveSegmentId(store), [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function deriveActiveSegmentId(store: EditorStore): string | null {
  const { document: doc, video } = store.snapshot();
  if (!doc) return null;
  const active = doc.getActiveSegments(video.currentTime);
  if (active.length > 0) return active[0]!.id;
  const segs = doc.getSegments();
  if (segs.length === 0) return null;
  const nextIdx = segs.findIndex((s) => s.time.start > video.currentTime);
  const idx = nextIdx === -1 ? segs.length - 1 : Math.max(0, nextIdx - 1);
  return segs[idx]?.id ?? null;
}

/**
 * Segments active at the current playback time. The returned array
 * keeps reference identity across playback ticks while the set of
 * active segment ids is unchanged, so consumers re-render only at
 * segment boundaries or document edits — not on every tick.
 */
export function useActiveSegments(): readonly Segment[] {
  const store = useEditorStore();
  const cacheRef = useRef<ActiveSegmentsCache>({ doc: null, key: '\0', value: [] });
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('timechange', cb);
    store.addEventListener('change', cb);
    return () => {
      store.removeEventListener('timechange', cb);
      store.removeEventListener('change', cb);
    };
  }, [store]);
  const getSnapshot = useCallback(
    () => readCachedActiveSegments(store, cacheRef.current),
    [store],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

interface ActiveSegmentsCache {
  doc: Document | null;
  key: string;
  value: readonly Segment[];
}

// Cache key combines the document identity with the active id set.
// Document is immutable: every edit produces a new instance with new
// Segment/Line/Word instances, so a stale `doc` ref means a stale
// `value` even when the active id set didn't change.
function readCachedActiveSegments(store: EditorStore, cache: ActiveSegmentsCache): readonly Segment[] {
  const { document: doc, video } = store.snapshot();
  if (!doc) {
    if (cache.doc === null && cache.key === '') return cache.value;
    cache.doc = null;
    cache.key = '';
    cache.value = [];
    return cache.value;
  }
  const segs = doc.getActiveSegments(video.currentTime);
  const key = segs.map((s) => s.id).join('|');
  if (cache.doc === doc && cache.key === key) return cache.value;
  cache.doc = doc;
  cache.key = key;
  cache.value = segs;
  return cache.value;
}
