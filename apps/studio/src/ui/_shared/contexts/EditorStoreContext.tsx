import { createContext, useCallback, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
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
 * Latest cut registry held by the editor store. Re-renders only when
 * the registry instance changes (cuts edits, undo/redo, project
 * load) — not on every playback tick.
 */
export function useEditorCuts(): CutRegistry {
  const store = useEditorStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.snapshot().cuts, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
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
 * Id of the segment active at the current playback time inside
 * `document`, falling back to the most recently played segment when
 * nothing is active. The caller chooses which document to query —
 * pass the raw store document for surfaces that reason about the
 * underlying structure (cuts editor) and the cuts-filtered document
 * for surfaces that should track only what the user will see.
 * Re-renders only when the resolved id changes.
 */
export function useActiveSegmentId(document: Document | null): string | null {
  const store = useEditorStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('timechange', cb);
    return () => store.removeEventListener('timechange', cb);
  }, [store]);
  const getSnapshot = useCallback(
    () => resolveActiveSegmentId(document, store.snapshot().video.currentTime),
    [document, store],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

function resolveActiveSegmentId(document: Document | null, currentTime: number): string | null {
  if (!document) return null;
  const active = document.getActiveSegments(currentTime);
  if (active.length > 0) return active[0]!.id;
  const segs = document.getSegments();
  if (segs.length === 0) return null;
  const nextIdx = segs.findIndex((s) => s.time.start > currentTime);
  const idx = nextIdx === -1 ? segs.length - 1 : Math.max(0, nextIdx - 1);
  return segs[idx]?.id ?? null;
}

/**
 * Segments active at the current playback time inside `document`.
 * The caller chooses which document to query (see `useActiveSegmentId`
 * for the trade-off). The returned array keeps reference identity
 * across playback ticks while the set of active ids is unchanged, so
 * consumers re-render only at segment boundaries or document edits —
 * not on every tick.
 */
export function useActiveSegments(document: Document | null): readonly Segment[] {
  const store = useEditorStore();
  const cacheRef = useRef<ActiveSegmentsCache>({ doc: null, key: '\0', value: [] });
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('timechange', cb);
    return () => store.removeEventListener('timechange', cb);
  }, [store]);
  const getSnapshot = useCallback(
    () => readCachedActiveSegments(document, store.snapshot().video.currentTime, cacheRef.current),
    [document, store],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

interface ActiveSegmentsCache {
  doc: Document | null;
  key: string;
  value: readonly Segment[];
}

// Document is immutable: every edit produces a new instance with new
// Segment/Line/Word instances, so a stale `doc` ref means a stale
// `value` even when the active id set didn't change. The id key alone
// is therefore not sufficient.
function readCachedActiveSegments(
  document: Document | null,
  currentTime: number,
  cache: ActiveSegmentsCache,
): readonly Segment[] {
  if (!document) {
    if (cache.doc === null && cache.key === '') return cache.value;
    cache.doc = null;
    cache.key = '';
    cache.value = [];
    return cache.value;
  }
  const segs = document.getActiveSegments(currentTime);
  const key = segs.map((s) => s.id).join('|');
  if (cache.doc === document && cache.key === key) return cache.value;
  cache.doc = document;
  cache.key = key;
  cache.value = segs;
  return cache.value;
}
