import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronsRightLeft, ChevronUp, LocateFixed, Pencil, Search, Wand2, X } from 'lucide-react';
import type { ScrollRequest } from '@ui/captions/hooks/useCaptionsAutoScroll';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrides } from '@core/editor/domain/WordStyleOverrides';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import type { SegmentStyleOverrides } from '@core/editor/domain/SegmentStyleOverrides';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import type { SheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';
import { useCaptionsCallbacks } from '@ui/captions/hooks/useCaptionsCallbacks';
import type { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { FreeCaptionsView } from '@ui/captions/components/FreeCaptionsView';
import { AdvancedCaptionsView } from '@ui/captions/components/AdvancedCaptionsView';
import { AutoAssignDialog } from '@ui/captions/components/AutoAssignDialog';

type CaptionsMode = 'free' | 'advanced';

export interface SortedEntry {
  segment: Segment;
  flatIdx: number;
}

export interface CaptionsPanelProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  activeSheetId: string | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  videoDuration: number;
  isPlaying: boolean;
  textareaFocus: SegmentTextareaFocuser;
  onSeek: (time: number) => void;
  onSetSegmentStyleOverride: (segmentId: string, overrides: SegmentStyleOverrides) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
  onInsertSegment: (segIdx: number, position: 'before' | 'after') => string;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onSetWordStyleOverride: (wordId: string, overrides: WordStyleOverrides) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onAutoAssignSegments: <P>(sheetId: string, matcher: SheetMatcher<P>, params: P) => void;
  onCreateSheet: (name: string) => string | null;
  onResetSegmentLayout: (segmentId: string) => void;
}

const MODE_TOGGLE =
  'inline-flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

const ICON_BTN_ACTIVE =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-surface-3 border-none cursor-pointer ' +
  'text-fg-primary transition-colors duration-quick ease-standard focus-visible:outline-none';

const SEARCH_INPUT =
  'flex-1 min-w-0 bg-surface-2 border border-edge-subtle rounded-xs px-2 py-1 text-xs text-fg-primary ' +
  'placeholder:text-fg-faint outline-none focus:border-edge-medium transition-colors duration-quick ease-standard';

export const CaptionsPanel = memo(function CaptionsPanel(props: CaptionsPanelProps) {
  const {
    document, activeSegmentId, sheets, activeSheetId,
    wordStyleOverrides, segmentOverrides,
    videoDuration, isPlaying, textareaFocus,
    onSeek, onSetSegmentStyleOverride, onDeleteWords,
    onApplyStructureEdit, onInsertWord, onInsertSegment,
    onEditWordText, onEditWordTime, onEditWordTags, onSetWordStyleOverride,
    onAssignSegmentSheet, onAutoAssignSegments, onCreateSheet,
    onResetSegmentLayout,
  } = props;

  const captions = useCaptionsCallbacks();
  const isMobile = useIsMobileViewport();
  const [mode, setMode] = useState<CaptionsMode>('free');
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { matcherRegistry: registry } = useSheets();
  const canAutoAssign = !isMobile && registry.list().length > 0;

  const handleCommitSegmentTime = useCallback((segmentId: string, start: number, end: number) => {
    captions.editSegmentTime({ segmentId, start, end });
  }, [captions]);

  const sorted = useMemo<SortedEntry[]>(() => {
    if (!document) return [];
    const entries = document.getSegments().map((segment, flatIdx) => ({ segment, flatIdx }));
    return entries.sort((a, b) => {
      const ds = a.segment.time.start - b.segment.time.start;
      if (ds !== 0) return ds;
      const de = a.segment.time.end - b.segment.time.end;
      if (de !== 0) return de;
      return a.flatIdx - b.flatIdx;
    });
  }, [document]);

  const matches = useMemo<SortedEntry[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sorted.filter((e) => e.segment.getText().toLowerCase().includes(q));
  }, [searchQuery, sorted]);

  // Clamp & resolve the current match defensively: matches can shrink
  // beneath the previous index (user edits, query becomes more specific).
  const safeMatchIdx = matches.length === 0 ? 0 : Math.min(matchIdx, matches.length - 1);
  const currentMatchSegmentId = matches[safeMatchIdx]?.segment.id ?? null;
  const highlightedSegmentId = searchOpen ? currentMatchSegmentId : null;

  // Any change in the current-match identity (new query → first hit, or
  // navigating with ◀/▶) triggers a scroll request. The token bumps with
  // every navigation so cycling back to the same segment still scrolls.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!currentMatchSegmentId) return;
    setScrollRequest({ segmentId: currentMatchSegmentId, token: Date.now() });
  }, [currentMatchSegmentId, safeMatchIdx]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset transient search state on close, render-time so it lands without
  // a re-render tick.
  const [lastSearchOpen, setLastSearchOpen] = useState(searchOpen);
  if (searchOpen !== lastSearchOpen) {
    setLastSearchOpen(searchOpen);
    if (!searchOpen) {
      setSearchQuery('');
      setMatchIdx(0);
    }
  }

  // Autofocus the input when search opens.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const handleLocate = useCallback(() => {
    if (!activeSegmentId) return;
    setScrollRequest({ segmentId: activeSegmentId, token: Date.now() });
  }, [activeSegmentId]);

  const handleSearchNext = useCallback(() => {
    if (matches.length === 0) return;
    setMatchIdx((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const handleSearchPrev = useCallback(() => {
    if (matches.length === 0) return;
    setMatchIdx((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  // Desktop only. Mobile sticks to 'free'.
  const effectiveMode: CaptionsMode = isMobile ? 'free' : mode;
  const showTopbar = !isMobile;

  // The topbar is sticky inside the scroll ancestor and overlays the
  // scrolling content. Reserve its height as `scroll-padding-top` on the
  // ancestor so any scrollIntoView (e.g. textarea focus on arrow-key
  // navigation) lands the target below the bar instead of underneath it.
  const topbarRef = useRef<HTMLDivElement>(null);
  const scrollAncestorRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) return;
    if (!scrollAncestorRef.current) {
      let el: HTMLElement | null = topbar.parentElement;
      while (el) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll') break;
        el = el.parentElement;
      }
      scrollAncestorRef.current = el;
    }
    const scrollEl = scrollAncestorRef.current;
    if (!scrollEl) return;
    scrollEl.style.scrollPaddingTop = `${topbar.offsetHeight}px`;
    return () => { scrollEl.style.scrollPaddingTop = ''; };
  }, [showTopbar, searchOpen]);

  if (!document) {
    return (
      <div className="py-6 text-center text-sm text-fg-faint">
        Transcribe a video to see captions here.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {showTopbar && (
        <div ref={topbarRef} className="sticky top-0 z-10 bg-surface-1 border-b border-edge-subtle">
          <div className="flex items-center justify-between gap-2 px-1 py-1.5">
            <Tooltip
              text={effectiveMode === 'free' ? 'Switch to advanced mode (edit each word)' : 'Switch to free mode (edit as text)'}
              position="bottom"
            >
              <button
                type="button"
                className={MODE_TOGGLE}
                onClick={() => setMode(effectiveMode === 'free' ? 'advanced' : 'free')}
                aria-label={effectiveMode === 'free' ? 'Free mode, click to switch to advanced' : 'Advanced mode, click to switch to free'}
              >
                {effectiveMode === 'free' ? <Pencil size={12} /> : <ChevronsRightLeft size={12} />}
                {effectiveMode === 'free' ? 'Free' : 'Advanced'}
              </button>
            </Tooltip>
            <div className="flex items-center gap-0.5">
              <Tooltip text="Go to current scene" position="bottom">
                <button
                  type="button"
                  className={ICON_BTN}
                  onClick={handleLocate}
                  disabled={!activeSegmentId}
                  aria-label="Go to current scene"
                >
                  <LocateFixed size={14} />
                </button>
              </Tooltip>
              <Tooltip text={searchOpen ? 'Close search' : 'Search scenes'} position="bottom">
                <button
                  type="button"
                  className={searchOpen ? ICON_BTN_ACTIVE : ICON_BTN}
                  onClick={() => setSearchOpen((v) => !v)}
                  aria-label={searchOpen ? 'Close search' : 'Search scenes'}
                >
                  <Search size={14} />
                </button>
              </Tooltip>
              {canAutoAssign && (
                <Tooltip text="Auto-group scenes by rule" position="bottom">
                  <button
                    type="button"
                    className={ICON_BTN}
                    onClick={() => setAutoAssignOpen(true)}
                    aria-label="Auto-group scenes"
                  >
                    <Wand2 size={14} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          {searchOpen && (
            <div className="flex items-center gap-1 px-1 py-1.5 border-t border-edge-subtle">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setMatchIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) handleSearchPrev(); else handleSearchNext();
                  }
                }}
                placeholder="Find in scenes…"
                spellCheck={false}
                className={SEARCH_INPUT}
              />
              <span className="text-2xs text-fg-faint tabular-nums font-mono px-1 shrink-0">
                {matches.length === 0 ? '0/0' : `${safeMatchIdx + 1}/${matches.length}`}
              </span>
              <button
                type="button"
                className={ICON_BTN}
                onClick={handleSearchPrev}
                disabled={matches.length === 0}
                aria-label="Previous match"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className={ICON_BTN}
                onClick={handleSearchNext}
                disabled={matches.length === 0}
                aria-label="Next match"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                className={ICON_BTN}
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
      <AutoAssignDialog
        open={autoAssignOpen}
        document={document}
        sheets={sheets}
        initialSheetId={activeSheetId}
        onApply={(sheetId, matcher, params) => {
          onAutoAssignSegments(sheetId, matcher, params);
          setAutoAssignOpen(false);
        }}
        onCancel={() => setAutoAssignOpen(false)}
      />

      {effectiveMode === 'advanced' ? (
        <AdvancedCaptionsView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={scrollRequest}
          highlightedSegmentId={highlightedSegmentId}
          sheets={sheets}
          wordStyleOverrides={wordStyleOverrides}
          segmentOverrides={segmentOverrides}
          videoDuration={videoDuration}
          onSeek={onSeek}
          onEditWordText={onEditWordText}
          onEditWordTime={onEditWordTime}
          onEditWordTags={onEditWordTags}
          onSetWordStyleOverride={onSetWordStyleOverride}
          onSetSegmentStyleOverride={onSetSegmentStyleOverride}
          onDeleteWords={onDeleteWords}
          onApplyStructureEdit={onApplyStructureEdit}
          onInsertWord={onInsertWord}
          onInsertSegment={onInsertSegment}
          onAssignSegmentSheet={onAssignSegmentSheet}
          onCreateSheet={onCreateSheet}
          onCommitSegmentTime={handleCommitSegmentTime}
          onRedistributeWords={captions.redistributeWords}
          onResetSegmentLayout={onResetSegmentLayout}
        />
      ) : (
        <FreeCaptionsView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={scrollRequest}
          highlightedSegmentId={highlightedSegmentId}
          sheets={sheets}
          segmentOverrides={segmentOverrides}
          videoDuration={videoDuration}
          textareaFocus={textareaFocus}
          onSeek={onSeek}
          onApplyStructureEdit={onApplyStructureEdit}
          onDeleteWords={onDeleteWords}
          onAssignSegmentSheet={onAssignSegmentSheet}
          onCreateSheet={onCreateSheet}
          onSetSegmentStyleOverride={onSetSegmentStyleOverride}
          onInsertSegment={onInsertSegment}
          onResetSegmentLayout={onResetSegmentLayout}
        />
      )}
    </div>
  );
});
