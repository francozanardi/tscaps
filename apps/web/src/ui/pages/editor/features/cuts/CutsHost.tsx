import { memo, useEffect, useMemo } from 'react';
import { Scissors } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { CutRange, CutRegistry } from '@core/cuts/domain/CutRegistry';
import { CutsTimelineProjection } from '@presentation/cuts/services/CutsTimelineProjection';
import { CutsEditingController } from '@presentation/cuts/controllers/CutsEditingController';
import { CutsWaveformController } from '@presentation/cuts/controllers/CutsWaveformController';
import { CutsKeyboardShortcutsController } from '@presentation/cuts/controllers/CutsKeyboardShortcutsController';
import { CutsSelectionPlaybackController } from '@presentation/cuts/controllers/CutsSelectionPlaybackController';
import {
  FindAndLocateShortcutsController,
  FIND_SHORTCUT,
  LOCATE_SHORTCUT,
} from '@presentation/editor/controllers/FindAndLocateShortcutsController';
import { useKeyboardShortcutLabeler } from '@ui/pages/editor/contexts/KeyboardShortcutLabelerContext';
import {
  CutsEditingControllerProvider,
} from '@ui/pages/editor/features/cuts/contexts/CutsEditingContext';
import {
  CutsWaveformControllerProvider,
  useCutsWaveformController,
} from '@ui/pages/editor/features/cuts/contexts/CutsWaveformContext';
import { CutsTimeline } from '@ui/pages/editor/features/cuts/components/CutsTimeline';
import { useCutsWaveformState } from '@ui/pages/editor/features/cuts/hooks/useCutsWaveform';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';
import {
  useSegmentSearchControls,
  type SearchableSegment,
} from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { LocateButton } from '@ui/pages/editor/components/LocateButton';
import { SearchToggleButton } from '@ui/pages/editor/components/SearchToggleButton';
import { SegmentSearchInputBar } from '@ui/pages/editor/components/SegmentSearchInputBar';
import { ClearAllCutsButton } from '@ui/pages/editor/features/cuts/components/ClearAllCutsButton';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

interface CutsHostProps {
  document: Document | null;
  videoFile: File | null;
  videoDurationSec: number;
  cuts: CutRegistry;
  activeSegmentId: string | null;
  isPlaying: boolean;
  onSeek: (timeSec: number) => void;
  onPause: () => void;
  onScheduleAudioMute: (wallClockSec: number) => void;
  onCancelScheduledAudioMute: () => void;
  onAddCut: (range: CutRange) => void;
  onRestoreRange: (range: CutRange) => void;
  onResizeCut: (originalRange: CutRange, newRange: CutRange) => void;
  onClearAllCuts: () => void;
}

const CARD_CLASS =
  'relative flex flex-col h-full min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';

const EMPTY_BODY_CLASS =
  'flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center px-6 py-8';

const SCROLL_BODY_CLASS =
  'flex-1 min-h-0 overflow-y-auto '
  + '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

const BANNER_CLASS =
  'shrink-0 px-3 py-2 text-2xs font-mono uppercase tracking-wider text-fg-muted border-b border-edge-subtle bg-surface-2';

const ERROR_BANNER_CLASS =
  'shrink-0 px-3 py-2 text-2xs text-danger border-b border-danger/40 bg-danger/10';

const TOPBAR_CLASS = 'sticky top-0 z-10 bg-surface-1 border-b border-edge-subtle';

const TOPBAR_INNER_CLASS = 'flex items-center justify-end gap-0.5 px-1 py-1.5';

/**
 * Panel for the Cuts mode. Owns the mode's presentation controllers
 * (audio waveform extraction and drag-selection state), publishes them
 * to the subtree, and renders the per-segment timeline derived from
 * the active document. Triggers waveform extraction the first time
 * the user enters Cuts mode while a video is loaded. Click-to-seek
 * and drag-to-select are wired through the editing controller;
 * committed cuts come from the editor store via props so they
 * participate in undo/redo.
 */
export const CutsHost = memo(function CutsHost(props: CutsHostProps) {
  const { audioDecoder } = useEngine();
  const cuts = useCuts();
  const store = useEditorStore();
  const activeMode = useActiveEditorMode();
  const { onSeek, onPause, onScheduleAudioMute, onCancelScheduledAudioMute } = props;
  const editingController = useMemo(() => new CutsEditingController(), []);
  const waveformController = useMemo(
    () => new CutsWaveformController(audioDecoder),
    [audioDecoder],
  );
  const keyboardController = useMemo(
    () => new CutsKeyboardShortcutsController(editingController, cuts.actions.add),
    [editingController, cuts.actions.add],
  );
  const selectionPlaybackController = useMemo(
    () => new CutsSelectionPlaybackController(
      store,
      editingController,
      onSeek,
      onPause,
      onScheduleAudioMute,
      onCancelScheduledAudioMute,
    ),
    [store, editingController, onSeek, onPause, onScheduleAudioMute, onCancelScheduledAudioMute],
  );
  useEffect(() => {
    if (activeMode !== 'cuts') return;
    keyboardController.start();
    selectionPlaybackController.start();
    return () => {
      keyboardController.stop();
      selectionPlaybackController.stop();
    };
  }, [activeMode, keyboardController, selectionPlaybackController]);
  return (
    <CutsEditingControllerProvider value={editingController}>
      <CutsWaveformControllerProvider value={waveformController}>
        <CutsBody {...props} />
      </CutsWaveformControllerProvider>
    </CutsEditingControllerProvider>
  );
});

function CutsBody({
  document,
  videoFile,
  videoDurationSec,
  cuts,
  activeSegmentId,
  isPlaying,
  onSeek,
  onAddCut,
  onRestoreRange,
  onResizeCut,
  onClearAllCuts,
}: CutsHostProps) {
  const projection = useMemo(() => new CutsTimelineProjection(), []);
  const rows = useMemo(
    () => (document ? projection.build(document, videoDurationSec) : []),
    [projection, document, videoDurationSec],
  );
  const waveformController = useCutsWaveformController();
  const waveformState = useCutsWaveformState();
  const activeMode = useActiveEditorMode();
  const shortcutLabeler = useKeyboardShortcutLabeler();
  const findShortcutLabel = useMemo(() => shortcutLabeler.label(FIND_SHORTCUT), [shortcutLabeler]);
  const locateShortcutLabel = useMemo(() => shortcutLabeler.label(LOCATE_SHORTCUT), [shortcutLabeler]);

  useEffect(() => {
    if (activeMode !== 'cuts' || !videoFile) return;
    void waveformController.loadFor(videoFile);
  }, [activeMode, videoFile, waveformController]);

  const searchableItems = useMemo<SearchableSegment[]>(
    () => rows.map((row) => ({
      id: row.segmentId,
      searchableText: row.cells
        .filter((cell) => cell.kind === 'word')
        .map((cell) => cell.text)
        .join(' '),
    })),
    [rows],
  );
  const search = useSegmentSearchControls(searchableItems, activeSegmentId);

  const findAndLocateShortcuts = useMemo(
    () => new FindAndLocateShortcutsController(search.openSearch, search.locate),
    [search.openSearch, search.locate],
  );
  useEffect(() => {
    if (activeMode !== 'cuts') return;
    findAndLocateShortcuts.start();
    return () => findAndLocateShortcuts.stop();
  }, [activeMode, findAndLocateShortcuts]);

  if (rows.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <div className={EMPTY_BODY_CLASS}>
          <Scissors size={32} className="text-fg-faint" />
          <p className="text-sm text-fg-muted m-0">
            Load a video to start cutting silences and bad takes.
          </p>
        </div>
      </div>
    );
  }

  const waveformData = waveformState.kind === 'ready' ? waveformState.data : null;

  return (
    <div className={CARD_CLASS}>
      {waveformState.kind === 'loading' && (
        <div className={BANNER_CLASS}>Analyzing audio…</div>
      )}
      {waveformState.kind === 'error' && (
        <div className={ERROR_BANNER_CLASS}>{waveformState.message}</div>
      )}
      <div className={SCROLL_BODY_CLASS}>
        <div className={TOPBAR_CLASS}>
          <div className={TOPBAR_INNER_CLASS}>
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
            <ClearAllCutsButton
              disabled={cuts.isEmpty()}
              onClear={onClearAllCuts}
            />
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
        <CutsTimeline
          rows={rows}
          cuts={cuts.list()}
          waveform={waveformData}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          isActive={activeMode === 'cuts'}
          scrollRequest={search.scrollRequest}
          highlightedSegmentId={search.highlightedSegmentId}
          onSeek={onSeek}
          onAddCut={onAddCut}
          onRestoreRange={onRestoreRange}
          onResizeCut={onResizeCut}
        />
      </div>
    </div>
  );
}
