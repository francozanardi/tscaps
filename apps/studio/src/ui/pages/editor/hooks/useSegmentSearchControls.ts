import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';

export interface ScrollRequest {
  readonly segmentId: string;
  readonly token: number;
}

export interface SearchableSegment {
  readonly id: string;
  readonly searchableText: string;
}

export interface SegmentSearchControls {
  readonly searchOpen: boolean;
  readonly searchQuery: string;
  readonly matchCount: number;
  readonly currentMatchOrdinal: number;
  readonly searchInputRef: RefObject<HTMLInputElement>;
  readonly scrollRequest: ScrollRequest | null;
  readonly highlightedSegmentId: string | null;
  readonly canLocate: boolean;
  openSearch(): void;
  closeSearch(): void;
  setSearchQuery(query: string): void;
  nextMatch(): void;
  prevMatch(): void;
  locate(): void;
}

/**
 * State + handlers for the panel's Search and "Go to current scene"
 * actions. Tracks search open/closed, the current query, the active
 * match's ordinal, and the `ScrollRequest` consumed by the
 * virtualizer's auto-scroll. Pure UI state — nothing here outlives
 * the panel mount.
 *
 * `items` must carry pre-extracted searchable text per segment so the
 * hook stays generic across panels. `activeSegmentId` is the
 * playhead-active segment used by Locate.
 */
export function useSegmentSearchControls(
  items: ReadonlyArray<SearchableSegment>,
  activeSegmentId: string | null,
): SegmentSearchControls {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQueryState] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo<SearchableSegment[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => item.searchableText.toLowerCase().includes(q));
  }, [searchQuery, items]);

  // Defensive clamp: edits or a narrower query can shrink `matches`
  // below the previously selected index.
  const safeMatchIdx = matches.length === 0 ? 0 : Math.min(matchIdx, matches.length - 1);
  const currentMatchSegmentId = matches[safeMatchIdx]?.id ?? null;
  const highlightedSegmentId = searchOpen ? currentMatchSegmentId : null;

  // Bump scrollRequest whenever the current-match identity changes (new
  // query → first hit, navigating ◀/▶, or cycling back to the same id).
  // `token` disambiguates same-id revisits so the auto-scroll effect
  // re-fires every time.
  const lastMatchKeyRef = useRef<string | null>(null);
  const matchKey = currentMatchSegmentId === null ? null : `${currentMatchSegmentId}:${safeMatchIdx}`;
  if (matchKey !== null && matchKey !== lastMatchKeyRef.current) {
    lastMatchKeyRef.current = matchKey;
    setScrollRequest({ segmentId: currentMatchSegmentId!, token: Date.now() });
  } else if (matchKey === null) {
    lastMatchKeyRef.current = null;
  }

  // Reset transient search state on close at render time so the next
  // open starts from a clean slate.
  const [lastSearchOpen, setLastSearchOpen] = useState(searchOpen);
  if (searchOpen !== lastSearchOpen) {
    setLastSearchOpen(searchOpen);
    if (!searchOpen) {
      setSearchQueryState('');
      setMatchIdx(0);
    }
  }

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    // Focus on next frame so the input is mounted (first open) or
    // already mounted (re-open while open).
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setMatchIdx(0);
  }, []);

  const nextMatch = useCallback(() => {
    setMatchIdx((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length));
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    setMatchIdx((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length));
  }, [matches.length]);

  const locate = useCallback(() => {
    if (!activeSegmentId) return;
    setScrollRequest({ segmentId: activeSegmentId, token: Date.now() });
  }, [activeSegmentId]);

  return {
    searchOpen,
    searchQuery,
    matchCount: matches.length,
    currentMatchOrdinal: matches.length === 0 ? 0 : safeMatchIdx + 1,
    searchInputRef,
    scrollRequest,
    highlightedSegmentId,
    canLocate: activeSegmentId !== null,
    openSearch,
    closeSearch,
    setSearchQuery,
    nextMatch,
    prevMatch,
    locate,
  };
}
