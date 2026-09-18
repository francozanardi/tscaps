import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsRightLeft, Pencil } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { HOOK_SHEET_ID, HOOK_SHEET_COLOR } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
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
import { TranscriptActionsPopover } from '@ui/pages/editor/features/transcript/components/TranscriptActionsPopover';
import { PickModeHeader } from '@ui/pages/editor/features/transcript/components/pick-mode/PickModeHeader';
import { PickModeBottomBar } from '@ui/pages/editor/features/transcript/components/pick-mode/PickModeBottomBar';
import { useScenePickController } from '@ui/pages/editor/features/transcript/contexts/ScenePickContext';
import { useScenePickSnapshot } from '@ui/pages/editor/features/transcript/hooks/useScenePickSnapshot';
import { LocateButton } from '@ui/pages/editor/components/LocateButton';
import { SearchToggleButton } from '@ui/pages/editor/components/SearchToggleButton';
import { SegmentSearchInputBar } from '@ui/pages/editor/components/SegmentSearchInputBar';
import {
  useSegmentSearchControls,
  type SearchableSegment,
} from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';
import { BulkModeHeader } from '@ui/pages/editor/features/transcript/components/bulk-mode/BulkModeHeader';
import { BulkModeBottomBar } from '@ui/pages/editor/features/transcript/components/bulk-mode/BulkModeBottomBar';
import { BulkActionsPopover, type BulkStyleContext } from '@ui/pages/editor/features/transcript/components/bulk-mode/BulkActionsPopover';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
import { useTelemetry } from '@ui/_shared/contexts/modules/TelemetryContext';
import { BulkModeTelemetryReporter } from '@presentation/telemetry/services/BulkModeTelemetryReporter';

type CaptionsMode = 'free' | 'advanced';
type BulkTarget = 'scenes' | 'words';

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
  elementStyles: ElementStyles;
  behindActorOverrides: BehindActorSegmentOverrideRegistry;
  frozenSegments: FrozenSegmentSet;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
  cuts: CutRegistry;
  cutAwareDocumentBuilder: CutAwareDocumentBuilder;
  textareaFocus: SegmentTextareaFocuser;
  onSeek: (time: number) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
  onInsertSegment: (anchorRef: string | number | null, position: 'before' | 'after') => string;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onResetSegmentLayout: (segmentId: string) => void;
  onEditSelectedWordTag: (wordIds: ReadonlySet<string>, tagName: string, enabled: boolean) => void;
  onSetSelectedBehindActor: (segmentIds: ReadonlySet<string>, override: BehindActorSegmentOverride) => void;
  onAssignSelectedSegmentsSheet: (segmentIds: ReadonlySet<string>, sheetId: string) => void;
  onSetSelectedStyleField: (elementIds: ReadonlyArray<string>, kind: ElementKind, control: AuthoredElementControl, value: ElementControlValue) => void;
  onBulkModeChange: (active: boolean) => void;
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set();

const MODE_TOGGLE =
  'inline-flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2';

export const TranscriptPanel = memo(function TranscriptPanel(props: TranscriptPanelProps) {
  const {
    document, activeSegmentId, sheets,
    elementStyles, behindActorOverrides, frozenSegments, decorationOverrides,
    videoDuration, isPlaying, cuts, cutAwareDocumentBuilder, textareaFocus,
    onSeek, onDeleteWords,
    onApplyStructureEdit, onInsertWord, onInsertSegment,
    onEditWordText, onEditWordTime, onEditWordTags,
    onAssignSegmentSheet, onCreateSheet,
    onResetSegmentLayout,
    onEditSelectedWordTag,
    onSetSelectedBehindActor, onAssignSelectedSegmentsSheet, onSetSelectedStyleField, onBulkModeChange,
  } = props;

  const captions = useTranscriptCallbacks();
  const isMobile = useIsMobileViewport();
  const activeMode = useActiveEditorMode();
  const shortcutLabeler = useKeyboardShortcutLabeler();
  const findShortcutLabel = useMemo(() => shortcutLabeler.label(FIND_SHORTCUT), [shortcutLabeler]);
  const locateShortcutLabel = useMemo(() => shortcutLabeler.label(LOCATE_SHORTCUT), [shortcutLabeler]);
  const [mode, setMode] = useState<CaptionsMode>('free');
  const [wandMenuOpen, setWandMenuOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<BulkTarget | null>(null);
  const [bulkSelection, setBulkSelection] = useState<ReadonlySet<string>>(EMPTY_ID_SET);
  const bulkAnchorRef = useRef<string | null>(null);
  const telemetry = useTelemetry();
  const bulkTelemetry = useMemo(() => new BulkModeTelemetryReporter(telemetry), [telemetry]);
  const sheetsModule = useSheets();
  const personSegmentation = usePersonSegmentation();
  const setHookScenes = sheetsModule.actions.sheets.setHookScenes;

  const pickSnapshot = useScenePickSnapshot();
  const pickActive = pickSnapshot.isActive;

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

  const scenePickController = useScenePickController();

  const currentHookSegmentIds = useMemo<ReadonlySet<string>>(() => {
    if (!document) return EMPTY_ID_SET;
    const ids = new Set<string>();
    for (const section of document.sections) {
      if (section.kind !== HOOK_SHEET_ID) continue;
      for (const segment of section.segments) ids.add(segment.id);
    }
    return ids;
  }, [document]);

  const selectionDurationSeconds = useMemo(() => {
    if (!pickActive) return 0;
    let total = 0;
    for (const entry of sorted) {
      if (pickSnapshot.selection.has(entry.segment.id)) total += entry.segment.time.end - entry.segment.time.start;
    }
    return total;
  }, [pickActive, pickSnapshot.selection, sorted]);

  const handleEnterHookPick = useCallback(() => {
    setWandMenuOpen(false);
    scenePickController.enter({
      constraint: 'contiguous-from-start',
      initialSelection: currentHookSegmentIds,
    });
    // The selection runs from the first scene, and what the user picks is
    // where it ends. Reading that off a list scrolled to the middle of the
    // video means guessing what is selected above the fold.
    const first = sorted[0];
    if (first) search.scrollTo(first.segment.id);
  }, [scenePickController, currentHookSegmentIds, sorted, search]);

  const handleConfirmPick = useCallback(() => {
    setHookScenes.execute(scenePickController.snapshot().selection);
    scenePickController.exit();
  }, [scenePickController, setHookScenes]);

  const handleClearPick = useCallback(() => {
    setHookScenes.execute(EMPTY_ID_SET);
    scenePickController.exit();
  }, [scenePickController, setHookScenes]);

  const handleCancelPick = useCallback(() => {
    scenePickController.exit();
  }, [scenePickController]);

  useEffect(() => {
    if (!pickActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      scenePickController.exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickActive, scenePickController]);

  useEffect(() => () => scenePickController.exit(), [scenePickController]);

  // Desktop only. Mobile sticks to 'free'.
  const effectiveMode: CaptionsMode = isMobile ? 'free' : mode;
  const showTopbar = !isMobile;

  const selectableIds = useMemo<ReadonlyArray<string>>(() => {
    if (bulkTarget === 'scenes') return sorted.map((entry) => entry.segment.id);
    if (bulkTarget === 'words') {
      return sorted.flatMap((entry) => entry.segment.lines.flatMap((line) => line.words))
        .filter((word) => !cuts.containsTimeRange(word.time.start, word.time.end))
        .map((word) => word.id);
    }
    return [];
  }, [bulkTarget, sorted, cuts]);

  const selectedSegments = useMemo(
    () => sorted.filter((entry) => bulkSelection.has(entry.segment.id)).map((entry) => entry.segment),
    [sorted, bulkSelection],
  );
  const selectedWords = useMemo(() => {
    if (bulkTarget !== 'words') return [];
    return sorted.flatMap((entry) => entry.segment.lines.flatMap((line) => line.words))
      .filter((word) => bulkSelection.has(word.id));
  }, [bulkTarget, sorted, bulkSelection]);
  const selectedSheetId = useMemo(() => {
    if (selectedSegments.length === 0) return null;
    const ids = new Set(selectedSegments.map((segment) => (
      sorted.find((entry) => entry.segment.id === segment.id)?.sectionKind ?? null
    )));
    return ids.size === 1 ? ([...ids][0] ?? null) : null;
  }, [selectedSegments, sorted]);
  const bulkStyleContext = useMemo<BulkStyleContext | null>(() => {
    if (bulkTarget === 'scenes') {
      const segment = selectedSegments[0];
      if (!segment) return null;
      const entry = sorted.find((candidate) => candidate.segment.id === segment.id);
      const sheet = sheets.find((candidate) => candidate.id === entry?.sectionKind);
      return sheet ? { representativeId: segment.id, kind: 'segment', sheet, ancestorIds: [] } : null;
    }
    if (bulkTarget === 'words') {
      const word = selectedWords[0];
      if (!word) return null;
      for (const entry of sorted) {
        if (!entry.segment.getWords().some((candidate) => candidate.id === word.id)) continue;
        const sheet = sheets.find((candidate) => candidate.id === entry.sectionKind);
        return sheet ? { representativeId: word.id, kind: 'word', sheet, ancestorIds: [entry.segment.id] } : null;
      }
    }
    return null;
  }, [bulkTarget, selectedSegments, selectedWords, sorted, sheets]);

  const behindActorSegments = useMemo(() => {
    if (!personSegmentation.previewSupportChecker.isSupported()) return [];
    return selectedSegments.filter((segment) => {
      const entry = sorted.find((candidate) => candidate.segment.id === segment.id);
      const sheet = sheets.find((candidate) => candidate.id === entry?.sectionKind);
      return sheet?.template.features.behindActorOverride === true;
    });
  }, [personSegmentation, selectedSegments, sorted, sheets]);

  const enterBulkMode = useCallback((target: BulkTarget) => {
    setWandMenuOpen(false);
    setBulkSelection(EMPTY_ID_SET);
    bulkAnchorRef.current = null;
    setBulkTarget(target);
    onBulkModeChange(true);
    bulkTelemetry.entered();
  }, [onBulkModeChange, bulkTelemetry]);

  const exitBulkMode = useCallback(() => {
    if (bulkTarget !== null) bulkTelemetry.exited(bulkTarget);
    setBulkTarget(null);
    setBulkSelection(EMPTY_ID_SET);
    bulkAnchorRef.current = null;
    onBulkModeChange(false);
  }, [onBulkModeChange, bulkTarget, bulkTelemetry]);

  const toggleBulkItem = useCallback((id: string, extendRange: boolean) => {
    setBulkSelection((current) => {
      const next = new Set(current);
      const anchorIndex = bulkAnchorRef.current === null ? -1 : selectableIds.indexOf(bulkAnchorRef.current);
      const targetIndex = selectableIds.indexOf(id);
      if (extendRange && anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        for (const rangeId of selectableIds.slice(start, end + 1)) next.add(rangeId);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      bulkAnchorRef.current = id;
      return next;
    });
  }, [selectableIds]);

  useEffect(() => {
    if (bulkTarget === null) return;
    const liveIds = new Set(selectableIds);
    setBulkSelection((current) => {
      const next = new Set([...current].filter((id) => liveIds.has(id)));
      if (next.size === current.size) return current;
      return next;
    });
  }, [bulkTarget, selectableIds]);

  useEffect(() => () => onBulkModeChange(false), [onBulkModeChange]);

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
  }, [showTopbar, search.searchOpen, bulkTarget]);

  if (!document) {
    return (
      <div className="py-6 text-center text-sm text-fg-faint">
        Transcribe a video to see captions here.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {bulkTarget !== null ? (
        <BulkModeHeader ref={topbarRef} target={bulkTarget} onClose={exitBulkMode} />
      ) : pickActive ? (
        <PickModeHeader
          ref={topbarRef}
          title="Choose your hook scenes"
          hint="Click a scene to mark where the hook ends."
          accentColor={HOOK_SHEET_COLOR}
          cancelLabel="Cancel hook selection"
          cancelHint="Cancel (Esc)"
          onCancel={handleCancelPick}
        />
      ) : (
        showTopbar && (
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
                <TranscriptActionsPopover
                  open={wandMenuOpen}
                  onOpenChange={setWandMenuOpen}
                  onSetHookScenes={handleEnterHookPick}
                  onSelectScenes={() => enterBulkMode('scenes')}
                  onSelectWords={() => enterBulkMode('words')}
                />
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
        )
      )}
      {effectiveMode === 'advanced' || bulkTarget === 'words' ? (
        <AdvancedTranscriptView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={search.scrollRequest}
          highlightedSegmentId={search.highlightedSegmentId}
          sheets={sheets}
          elementStyles={elementStyles}
          behindActorOverrides={behindActorOverrides}
          frozenSegments={frozenSegments}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
          cuts={cuts}
          cutAwareDocumentBuilder={cutAwareDocumentBuilder}
          onSeek={onSeek}
          onEditWordText={onEditWordText}
          onEditWordTime={onEditWordTime}
          onEditWordTags={onEditWordTags}
          onDeleteWords={onDeleteWords}
          onApplyStructureEdit={onApplyStructureEdit}
          onInsertWord={onInsertWord}
          onInsertSegment={onInsertSegment}
          onAssignSegmentSheet={onAssignSegmentSheet}
          onCreateSheet={onCreateSheet}
          onCommitSegmentTime={handleCommitSegmentTime}
          onRedistributeWords={captions.redistributeWords}
          onResetSegmentLayout={onResetSegmentLayout}
          bulkTarget={bulkTarget}
          bulkSelection={bulkSelection}
          onToggleBulkItem={toggleBulkItem}
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
          elementStyles={elementStyles}
          behindActorOverrides={behindActorOverrides}
          frozenSegments={frozenSegments}
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
          onInsertSegment={onInsertSegment}
          onResetSegmentLayout={onResetSegmentLayout}
          bulkSelection={bulkTarget === 'scenes' ? bulkSelection : null}
          onToggleBulkScene={toggleBulkItem}
        />
      )}
      {pickActive && (
        <PickModeBottomBar
          selectionCount={pickSnapshot.selection.size}
          selectionDurationSeconds={selectionDurationSeconds}
          accentColor={HOOK_SHEET_COLOR}
          confirmLabel="Confirm as hook"
          clearLabel="Clear hook"
          canConfirm={pickSnapshot.selection.size > 0}
          showClear={pickSnapshot.initialSelection.size > 0}
          onConfirm={handleConfirmPick}
          onClear={handleClearPick}
        />
      )}
      {bulkTarget !== null && (
        <BulkModeBottomBar
          target={bulkTarget}
          selectionCount={bulkSelection.size}
          allSelected={selectableIds.length > 0 && bulkSelection.size === selectableIds.length}
          onToggleAll={() => setBulkSelection(
            selectableIds.length > 0 && bulkSelection.size === selectableIds.length
              ? EMPTY_ID_SET
              : new Set(selectableIds),
          )}
          onClear={() => setBulkSelection(EMPTY_ID_SET)}
          onDone={exitBulkMode}
          actions={(
            <BulkActionsPopover
              target={bulkTarget}
              segments={selectedSegments}
              words={selectedWords}
              sheets={sheets}
              assignedSheetId={selectedSheetId}
              styleContext={bulkStyleContext}
              canUseBehindActor={behindActorSegments.length > 0}
              onEditWordTag={(tagName, enabled) => {
                onEditSelectedWordTag(bulkSelection, tagName, enabled);
                bulkTelemetry.actionApplied('words', 'tags', bulkSelection.size);
              }}
              onSetBehindActor={(enabled) => {
                const ids = new Set(behindActorSegments.map((segment) => segment.id));
                onSetSelectedBehindActor(ids, enabled ? 'force-on' : 'force-off');
                bulkTelemetry.actionApplied('scenes', 'behind-actor', ids.size);
                if (enabled) {
                  for (const segment of behindActorSegments) {
                    personSegmentation.actions.ensureSegmentMasks.execute({
                      segmentId: segment.id,
                      range: { start: segment.time.start, end: segment.time.end },
                    }).catch((error) => console.error('[behind-actor] segment mask backfill failed', error));
                  }
                }
              }}
              onAssignSheet={(sheetId) => {
                onAssignSelectedSegmentsSheet(bulkSelection, sheetId);
                bulkTelemetry.actionApplied('scenes', 'sheet', bulkSelection.size);
              }}
              onCreateSheet={onCreateSheet}
              onEditStyle={(control, value) => {
                onSetSelectedStyleField([...bulkSelection], bulkTarget === 'scenes' ? 'segment' : 'word', control, value);
                bulkTelemetry.actionApplied(bulkTarget, 'style', bulkSelection.size);
              }}
              onDelete={() => {
                const wordIds = bulkTarget === 'words'
                  ? [...bulkSelection]
                  : selectedSegments.flatMap((segment) => segment.lines.flatMap((line) => line.words.map((word) => word.id)));
                onDeleteWords(wordIds);
                bulkTelemetry.actionApplied(bulkTarget, 'delete', bulkSelection.size);
              }}
            />
          )}
        />
      )}
    </div>
  );
});
