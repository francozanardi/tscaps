import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsRightLeft, Pencil, Wand2 } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { SheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';
import { useTranscriptCallbacks } from '@ui/pages/editor/features/transcript/hooks/useTranscriptCallbacks';
import type { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import {
  FindAndLocateShortcutsController,
  FIND_SHORTCUT,
  LOCATE_SHORTCUT,
} from '@presentation/editor/controllers/FindAndLocateShortcutsController';
import { useKeyboardShortcutLabeler } from '@ui/pages/editor/contexts/KeyboardShortcutLabelerContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { FreeTranscriptView } from '@ui/pages/editor/features/transcript/components/FreeTranscriptView';
import { AdvancedTranscriptView } from '@ui/pages/editor/features/transcript/components/AdvancedTranscriptView';
import { AutoAssignDialog } from '@ui/pages/editor/features/transcript/components/AutoAssignDialog';
import { LocateButton } from '@ui/pages/editor/components/LocateButton';
import { SearchToggleButton } from '@ui/pages/editor/components/SearchToggleButton';
import { SegmentSearchInputBar } from '@ui/pages/editor/components/SegmentSearchInputBar';
import {
  useSegmentSearchControls,
  type SearchableSegment,
} from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';

type CaptionsMode = 'free' | 'advanced';

export interface SortedEntry {
  segment: Segment;
  flatIdx: number;
  /** `kind` of the section that owns `segment`; used to look up the owning Sheet. */
  sectionKind: string;
}

export interface TranscriptPanelProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  activeSheetId: string | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
  cuts: CutRegistry;
  cutAwareDocumentBuilder: CutAwareDocumentBuilder;
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

export const TranscriptPanel = memo(function TranscriptPanel(props: TranscriptPanelProps) {
  const {
    document, activeSegmentId, sheets, activeSheetId,
    wordStyleOverrides, segmentOverrides, decorationOverrides,
    videoDuration, isPlaying, cuts, cutAwareDocumentBuilder, textareaFocus,
    onSeek, onSetSegmentStyleOverride, onDeleteWords,
    onApplyStructureEdit, onInsertWord, onInsertSegment,
    onEditWordText, onEditWordTime, onEditWordTags, onSetWordStyleOverride,
    onAssignSegmentSheet, onAutoAssignSegments, onCreateSheet,
    onResetSegmentLayout,
  } = props;

  const captions = useTranscriptCallbacks();
  const isMobile = useIsMobileViewport();
  const activeMode = useActiveEditorMode();
  const shortcutLabeler = useKeyboardShortcutLabeler();
  const findShortcutLabel = useMemo(() => shortcutLabeler.label(FIND_SHORTCUT), [shortcutLabeler]);
  const locateShortcutLabel = useMemo(() => shortcutLabeler.label(LOCATE_SHORTCUT), [shortcutLabeler]);
  const [mode, setMode] = useState<CaptionsMode>('free');
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const { matcherRegistry: registry } = useSheets();
  const canAutoAssign = !isMobile && registry.list().length > 0;

  const handleCommitSegmentTime = useCallback((segmentId: string, start: number, end: number) => {
    captions.editSegmentTime({ segmentId, start, end });
  }, [captions]);

  const sorted = useMemo<SortedEntry[]>(() => {
    if (!document) return [];
    const entries: SortedEntry[] = [];
    let flatIdx = 0;
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (cutAwareDocumentBuilder.buildSegment(segment, cuts) !== null) {
          entries.push({ segment, flatIdx, sectionKind: section.kind });
        }
        flatIdx++;
      }
    }
    return entries.sort((a, b) => {
      const ds = a.segment.time.start - b.segment.time.start;
      if (ds !== 0) return ds;
      const de = a.segment.time.end - b.segment.time.end;
      if (de !== 0) return de;
      return a.flatIdx - b.flatIdx;
    });
  }, [document, cuts, cutAwareDocumentBuilder]);

  const searchableItems = useMemo<SearchableSegment[]>(
    () => sorted.map((e) => ({ id: e.segment.id, searchableText: e.segment.getText() })),
    [sorted],
  );
  const search = useSegmentSearchControls(searchableItems, activeSegmentId);

  const shortcuts = useMemo(
    () => new FindAndLocateShortcutsController(search.openSearch, search.locate),
    [search.openSearch, search.locate],
  );
  useEffect(() => {
    if (activeMode !== 'captions') return;
    shortcuts.start();
    return () => shortcuts.stop();
  }, [activeMode, shortcuts]);

  // Desktop only. Mobile sticks to 'free'.
  const effectiveMode: CaptionsMode = isMobile ? 'free' : mode;
  const showTopbar = !isMobile;

  // The topbar is sticky inside the scroll ancestor and overlays the
  // scrolling content. Reserve its height as `scroll-padding-top` on
  // the ancestor so any scrollIntoView (e.g. textarea focus on arrow-
  // key navigation) lands the target below the bar instead of
  // underneath it.
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
  }, [showTopbar, search.searchOpen]);

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
              <LocateButton
                disabled={!search.canLocate}
                shortcutLabel={locateShortcutLabel}
                onLocate={search.locate}
              />
              <SearchToggleButton
                open={search.searchOpen}
                shortcutLabel={findShortcutLabel}
                onToggle={() => (search.searchOpen ? search.closeSearch() : search.openSearch())}
              />
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
          {search.searchOpen && (
            <SegmentSearchInputBar
              inputRef={search.searchInputRef}
              query={search.searchQuery}
              matchCount={search.matchCount}
              currentMatchOrdinal={search.currentMatchOrdinal}
              onQueryChange={search.setSearchQuery}
              onNext={search.nextMatch}
              onPrev={search.prevMatch}
              onClose={search.closeSearch}
            />
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
        <AdvancedTranscriptView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={search.scrollRequest}
          highlightedSegmentId={search.highlightedSegmentId}
          sheets={sheets}
          wordStyleOverrides={wordStyleOverrides}
          segmentOverrides={segmentOverrides}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
          cuts={cuts}
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
        <FreeTranscriptView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={search.scrollRequest}
          highlightedSegmentId={search.highlightedSegmentId}
          sheets={sheets}
          wordStyleOverrides={wordStyleOverrides}
          segmentOverrides={segmentOverrides}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
          cuts={cuts}
          cutAwareDocumentBuilder={cutAwareDocumentBuilder}
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
