import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { CutRange, CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { Silence } from '@core/cuts/domain/Silence';
import {
  TimelineProjection,
  type TimelineModel,
} from '@presentation/timeline/services/TimelineProjection';
import { TimelineSceneExtentResolver } from '@presentation/timeline/services/TimelineSceneExtentResolver';
import { TimelineScenePalette } from '@presentation/timeline/services/TimelineScenePalette';
import { TimelineRowIndexResolver } from '@presentation/timeline/services/TimelineRowIndexResolver';
import { TimelineWordGapFinder } from '@presentation/timeline/services/TimelineWordGapFinder';
import { TimelineScaleResolver } from '@presentation/timeline/services/TimelineScaleResolver';
import { TimelineWordDragTargets } from '@presentation/timeline/services/TimelineWordDragTargets';
import { TimelineSnapLandmarks } from '@presentation/timeline/services/TimelineSnapLandmarks';
import { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import { TimelineSceneEditGesture } from '@presentation/timeline/controllers/gestures/TimelineSceneEditGesture';
import { WaveformScaleResolver } from '@presentation/timeline/services/WaveformScaleResolver';
import { TimelinePointerTimeResolver } from '@presentation/timeline/services/TimelinePointerTimeResolver';
import { TimelineEdgeScrollVelocity } from '@presentation/timeline/services/TimelineEdgeScrollVelocity';
import { TimelineSnapResolver } from '@presentation/timeline/services/TimelineSnapResolver';
import { TimelineWordEditGesture } from '@presentation/timeline/controllers/gestures/TimelineWordEditGesture';
import { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import { TimelineCellHoverController } from '@presentation/timeline/controllers/TimelineCellHoverController';
import { TimelineRowViewportRegistry } from '@presentation/timeline/controllers/TimelineRowViewportRegistry';
import { TimelinePointerDragController } from '@presentation/timeline/controllers/TimelinePointerDragController';
import { TimelineWaveformController } from '@presentation/timeline/controllers/TimelineWaveformController';
import { TimelineKeyboardShortcutsController } from '@presentation/timeline/controllers/TimelineKeyboardShortcutsController';
import { TimelineSelectionPlaybackController } from '@presentation/timeline/controllers/TimelineSelectionPlaybackController';
import { TouchDragGestureResolver } from '@presentation/gestures/services/TouchDragGestureResolver';
import {
  FindAndLocateShortcutsController,
  FIND_SHORTCUT,
  LOCATE_SHORTCUT,
} from '@presentation/editor/controllers/FindAndLocateShortcutsController';
import { useKeyboardShortcutLabeler } from '@ui/pages/editor/contexts/KeyboardShortcutLabelerContext';
import {
  TimelineEditingControllerProvider,
} from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import {
  TimelinePointerDragControllerProvider,
} from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import {
  TimelineCellHoverControllerProvider,
} from '@ui/pages/editor/features/timeline/contexts/TimelineCellHoverContext';
import {
  TimelineWaveformControllerProvider,
  useTimelineWaveformController,
} from '@ui/pages/editor/features/timeline/contexts/TimelineWaveformContext';
import { Timeline } from '@ui/pages/editor/features/timeline/components/Timeline';
import { useTimelineWaveformState } from '@ui/pages/editor/features/timeline/hooks/useTimelineWaveform';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';
import {
  useSegmentSearchControls,
  type SearchableSegment,
} from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { LocateButton } from '@ui/pages/editor/components/LocateButton';
import { ChannelSelector } from '@ui/pages/editor/features/timeline/components/ChannelSelector';
import { ChannelMoveToast } from '@ui/pages/editor/features/timeline/components/ChannelMoveToast';
import { SearchToggleButton } from '@ui/pages/editor/components/SearchToggleButton';
import { SegmentSearchInputBar } from '@ui/pages/editor/components/SegmentSearchInputBar';
import { CutsMenuPopover } from '@ui/pages/editor/features/timeline/components/CutsMenuPopover';
import { PrecisePreviewControl } from '@ui/pages/editor/features/timeline/components/PrecisePreviewControl';
import {
  CutsActionToast,
  type CutsActionToastState,
} from '@ui/pages/editor/features/timeline/components/CutsActionToast';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TimelineChannelResolver } from '@presentation/timeline/services/TimelineChannelResolver';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useInitialWidthPx } from '@ui/_shared/hooks/useInitialWidthPx';
import { useTimelineZoom } from '@ui/pages/editor/features/timeline/hooks/useTimelineZoom';
import { useReleaseHeldSceneOutside } from '@ui/pages/editor/features/timeline/hooks/useReleaseHeldSceneOutside';
import { TimelineZoom } from '@presentation/timeline/services/TimelineZoom';
import { ZoomStepper } from '@ui/pages/editor/features/timeline/components/ZoomStepper';
import { TimelineVisibilityController } from '@presentation/timeline/controllers/TimelineVisibilityController';
import { useTimelineDetailVisibility } from '@ui/pages/editor/features/timeline/hooks/useTimelineDetailVisibility';
import { VisibilityMenuPopover } from '@ui/pages/editor/features/timeline/components/VisibilityMenuPopover';

const EMPTY_TIMELINE: TimelineModel = {
  rowDurationSec: 0,
  rows: [],
  scenes: [],
  dragTargets: new TimelineWordDragTargets([]),
  sceneDragTargets: new TimelineSceneDragTargets([]),
  snapLandmarks: new TimelineSnapLandmarks([]),
};

interface TimelineHostProps {
  document: Document | null;
  sheets: ReadonlyArray<Sheet>;
  videoFile: File | null;
  videoDurationSec: number;
  cuts: CutRegistry;
  activeSegmentId: string | null;
  isPlaying: boolean;
  onSeek: (timeSec: number) => void;
  onPause: () => void;
  onScheduleAudioMuteAt: (sourceTimeSec: number) => void;
  onCancelScheduledAudioMute: () => void;
  onAddCut: (range: CutRange) => void;
  onRestoreRange: (range: CutRange) => void;
  onResizeCut: (originalRange: CutRange, newRange: CutRange) => void;
  onClearAllCuts: () => void;
  onRemoveSilences: (silences: ReadonlyArray<Silence>) => void;
}

const CARD_CLASS =
  'relative flex flex-col h-full min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';

const EMPTY_BODY_CLASS =
  'flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center px-6 py-8';

const SCROLL_BODY_CLASS =
  'flex-1 min-h-0 overflow-y-auto '
  + '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

const ERROR_BANNER_CLASS =
  'shrink-0 px-3 py-2 text-2xs text-danger border-b border-danger/40 bg-danger/10';

// Above the scrolling body, never stuck to the top of it: a sticky bar
// looks identical and covers the first rows, while the virtualized list
// underneath goes on believing it owns the whole scroller. Nothing that
// overlays the rows may live inside their scroller.
const TOPBAR_CLASS = 'shrink-0 bg-surface-1 border-b border-edge-subtle';

// Two groups, not one row: what the reader is looking at on the left,
// what they can do to it on the right. Zoom sat in the middle of the
// actions before, splitting them, and the left half was empty anyway.
const TOPBAR_INNER_CLASS = 'flex items-center justify-between gap-0.5 px-1 py-1.5';
const TOPBAR_GROUP_CLASS = 'flex items-center gap-0.5';

const LIST_PADDING_CLASS = 'p-3';

/**
 * Panel for the Timeline mode. Owns the mode's presentation controllers
 * (audio waveform extraction and drag-selection state), publishes them
 * to the subtree, and renders the per-segment timeline derived from
 * the active document. Triggers waveform extraction the first time
 * the user enters Timeline mode while a video is loaded. Click-to-seek
 * and drag-to-select are wired through the editing controller;
 * committed cuts come from the editor store via props so they
 * participate in undo/redo.
 */
export const TimelineHost = memo(function TimelineHost(props: TimelineHostProps) {
  const cuts = useCuts();
  const captions = useCaptions();
  const store = useEditorStore();
  const activeMode = useActiveEditorMode();
  const { onSeek, onPause, onResizeCut, onScheduleAudioMuteAt, onCancelScheduledAudioMute } = props;
  const editingController = useMemo(() => new TimelineEditingController(), []);
  const cellHoverController = useMemo(() => new TimelineCellHoverController(), []);
  const rowRegistry = useMemo(() => new TimelineRowViewportRegistry(), []);
  const timeResolver = useMemo(() => new TimelinePointerTimeResolver(rowRegistry), [rowRegistry]);
  const edgeScrollVelocity = useMemo(() => new TimelineEdgeScrollVelocity(), []);
  const touchAxisResolver = useMemo(() => new TouchDragGestureResolver(), []);
  const snapResolver = useMemo(() => new TimelineSnapResolver(), []);
  const wordTimeBounds = captions.services.wordTimeBounds;
  const editWordTime = captions.actions.words.editTime;
  const wordEditGesture = useMemo(
    () => new TimelineWordEditGesture(
      editingController,
      wordTimeBounds,
      snapResolver,
      (wordId, startSec, endSec) => editWordTime.execute(wordId, startSec, endSec),
    ),
    [editingController, wordTimeBounds, snapResolver, editWordTime],
  );
  const editSegmentTime = captions.actions.segments.editTime;
  const sceneEditGesture = useMemo(
    () => new TimelineSceneEditGesture(
      editingController,
      (segmentId, start, end) => editSegmentTime.execute({ segmentId, start, end }),
    ),
    [editingController, editSegmentTime],
  );
  const dragController = useMemo(
    () => new TimelinePointerDragController(
      editingController,
      rowRegistry,
      timeResolver,
      edgeScrollVelocity,
      touchAxisResolver,
      wordEditGesture,
      sceneEditGesture,
      snapResolver,
      onSeek,
      onResizeCut,
    ),
    [
      editingController, rowRegistry, timeResolver, edgeScrollVelocity,
      touchAxisResolver, wordEditGesture, sceneEditGesture, snapResolver, onSeek, onResizeCut,
    ],
  );
  const waveformExtractor = cuts.services.waveformExtractor;
  const waveformController = useMemo(
    () => new TimelineWaveformController(waveformExtractor, new WaveformScaleResolver()),
    [waveformExtractor],
  );
  const keyboardController = useMemo(
    () => new TimelineKeyboardShortcutsController(
      editingController, cuts.actions.add, new TimelineSceneExtentResolver(),
    ),
    [editingController, cuts.actions.add],
  );
  // Published rather than closed over, so the controller and the window
  // listener it owns outlive every edit instead of being rebuilt by one.
  useEffect(() => {
    keyboardController.setDocument(props.document);
  }, [keyboardController, props.document]);
  const selectionPlaybackController = useMemo(
    () => new TimelineSelectionPlaybackController(
      store,
      editingController,
      onSeek,
      onPause,
      onScheduleAudioMuteAt,
      onCancelScheduledAudioMute,
    ),
    [store, editingController, onSeek, onPause, onScheduleAudioMuteAt, onCancelScheduledAudioMute],
  );
  useEffect(() => {
    if (activeMode !== 'timeline') return;
    keyboardController.start();
    selectionPlaybackController.start();
    return () => {
      keyboardController.stop();
      selectionPlaybackController.stop();
      dragController.cancel();
    };
  }, [activeMode, keyboardController, selectionPlaybackController, dragController]);
  return (
    <TimelineEditingControllerProvider value={editingController}>
      <TimelinePointerDragControllerProvider value={dragController}>
        <TimelineCellHoverControllerProvider value={cellHoverController}>
            <TimelineWaveformControllerProvider value={waveformController}>
              <TimelineBody {...props} />
            </TimelineWaveformControllerProvider>
        </TimelineCellHoverControllerProvider>
      </TimelinePointerDragControllerProvider>
    </TimelineEditingControllerProvider>
  );
});

function TimelineBody({
  document,
  sheets,
  videoFile,
  videoDurationSec,
  cuts,
  activeSegmentId,
  isPlaying,
  onAddCut,
  onRestoreRange,
  onClearAllCuts,
  onRemoveSilences,
}: TimelineHostProps) {
  const store = useEditorStore();
  const { silencePadder } = useCuts().services;
  const { segmentTimeBounds } = useCaptions().services;
  const scaleResolver = useMemo(() => new TimelineScaleResolver(), []);
  const zoomSteps = useMemo(() => new TimelineZoom(), []);
  const detailChoicesRepository = useCuts().repositories.timelineDetailChoices;
  const visibilityController = useMemo(
    () => new TimelineVisibilityController(detailChoicesRepository),
    [detailChoicesRepository],
  );
  const visibleDetails = useTimelineDetailVisibility(visibilityController);
  const showWaveform = visibleDetails.waveform;
  const channelResolver = useMemo(() => new TimelineChannelResolver(new TimelineSceneExtentResolver()), []);
  const projection = useMemo(
    () => new TimelineProjection(
      silencePadder,
      new TimelineSceneExtentResolver(),
      new TimelineRowIndexResolver(),
      new TimelineWordGapFinder(),
      segmentTimeBounds,
      new TimelineScenePalette().toneCount,
    ),
    [silencePadder, segmentTimeBounds],
  );
  // Measured once, never again. The width picks how many seconds a row
  // covers, and re-picking it on every resize frame would re-wrap every
  // word in the panel while the user is dragging its edge. Widening the
  // panel now zooms in instead: the same seconds, drawn larger.
  const [listRef, initialWidthPx] = useInitialWidthPx();
  const zoom = useTimelineZoom(
    scaleResolver, zoomSteps, document, initialWidthPx, videoDurationSec,
  );
  const rowDurationSec = zoom.rowDurationSec;
  const channels = useMemo(
    () => (document ? channelResolver.resolve(document, sheets) : []),
    [channelResolver, document, sheets],
  );
  const [pickedChannelId, setPickedChannelId] = useState<string | null>(null);
  // Falling back rather than correcting the state: a channel disappears
  // the moment its sheet stops overlapping, and rewriting the pick from
  // an effect would render once with a channel that is no longer there.
  const channel = channels.find((c) => c.id === pickedChannelId) ?? channels[0] ?? null;
  const channelSheetIds = useMemo(() => new Set(channel?.sheetIds ?? []), [channel]);
  const timeline = useMemo(() => {
    if (!document) return EMPTY_TIMELINE;
    return projection.build(document, videoDurationSec, rowDurationSec, channelSheetIds);
  }, [projection, document, videoDurationSec, rowDurationSec, channelSheetIds]);
  const panelRef = useRef<HTMLDivElement>(null);
  useReleaseHeldSceneOutside(panelRef);
  const [cutsMenuOpen, setCutsMenuOpen] = useState(false);
  const [cutsToast, setCutsToast] = useState<CutsActionToastState | null>(null);

  // Measured on the registry either side of the run rather than summed
  // from what was proposed: ranges already cut fuse into their
  // neighbours without adding anything, and compaction swallows dead air
  // nobody asked about, so only the difference is the truth.
  const reportCutsChange = useCallback((apply: () => void) => {
    const beforeSec = store.snapshot().cuts.totalSec();
    apply();
    const afterSec = store.snapshot().cuts.totalSec();
    setCutsToast({
      key: Date.now(),
      removedSec: afterSec - beforeSec,
      resultingSec: Math.max(0, videoDurationSec - afterSec),
    });
  }, [store, videoDurationSec]);
  const waveformController = useTimelineWaveformController();
  const waveformState = useTimelineWaveformState();
  const activeMode = useActiveEditorMode();
  const shortcutLabeler = useKeyboardShortcutLabeler();
  const findShortcutLabel = useMemo(() => shortcutLabeler.label(FIND_SHORTCUT), [shortcutLabeler]);
  const locateShortcutLabel = useMemo(() => shortcutLabeler.label(LOCATE_SHORTCUT), [shortcutLabeler]);

  // Reading the audio of a long video is minutes of decoding, so a
  // reader who has turned the waveform off is never made to wait for
  // one. Turning it back on is what asks for it.
  useEffect(() => {
    if (activeMode !== 'timeline' || !videoFile || !showWaveform) return;
    void waveformController.loadFor(videoFile);
  }, [activeMode, videoFile, showWaveform, waveformController]);

  const searchableItems = useMemo<SearchableSegment[]>(
    () => timeline.scenes.map((scene) => ({ id: scene.segmentId, searchableText: scene.text })),
    [timeline],
  );
  const search = useSegmentSearchControls(searchableItems, activeSegmentId);

  const findAndLocateShortcuts = useMemo(
    () => new FindAndLocateShortcutsController(search.openSearch, search.locate),
    [search.openSearch, search.locate],
  );
  useEffect(() => {
    if (activeMode !== 'timeline') return;
    findAndLocateShortcuts.start();
    return () => findAndLocateShortcuts.stop();
  }, [activeMode, findAndLocateShortcuts]);

  if (!videoFile || videoDurationSec <= 0) {
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

  // The rows are drawn while the audio is still being read, and the
  // strip joins them when it is ready. Holding the whole panel back for
  // it made sense while it was always drawn; now that it is asked for,
  // that wait would land on the press that asks — taking away the panel,
  // toolbar included, at the one moment the reader wants to see it
  // change. The reader keeps their place when the rows grow.
  const waveformData = showWaveform && waveformState.kind === 'ready' ? waveformState.data : null;

  return (
    <div ref={panelRef} className={CARD_CLASS}>
      {showWaveform && waveformState.kind === 'error' && (
        <div className={ERROR_BANNER_CLASS}>{waveformState.message}</div>
      )}
      <div className={TOPBAR_CLASS}>
        <div className={TOPBAR_INNER_CLASS}>
          <ChannelMoveToast
            channels={channels}
            sheets={sheets}
            readChannelId={channel?.id ?? null}
            isActive={activeMode === 'timeline'}
          />
          <CutsActionToast state={cutsToast} onDismiss={() => setCutsToast(null)} />
          <div className={TOPBAR_GROUP_CLASS}>
            <ZoomStepper
              zoomPercent={zoom.zoomPercent}
              canZoomIn={zoom.canZoomIn}
              canZoomOut={zoom.canZoomOut}
              canReset={zoom.canReset}
              onZoomIn={zoom.zoomIn}
              onZoomOut={zoom.zoomOut}
              onReset={zoom.reset}
            />
            <VisibilityMenuPopover
              visible={visibleDetails}
              onToggle={(detail) => visibilityController.toggle(detail)}
            />
            <ChannelSelector
              channels={channels}
              selectedId={channel?.id ?? null}
              onSelect={setPickedChannelId}
            />
          </div>
          <div className={TOPBAR_GROUP_CLASS}>
            <PrecisePreviewControl />
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
            {document && (
              <CutsMenuPopover
                open={cutsMenuOpen}
                onOpenChange={setCutsMenuOpen}
                document={document}
                videoDurationSec={videoDurationSec}
                cuts={cuts}
                onRemoveSilences={(silences) => reportCutsChange(() => onRemoveSilences(silences))}
                onRestoreAllCuts={() => reportCutsChange(onClearAllCuts)}
              />
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
      <div className={SCROLL_BODY_CLASS}>
        {/* The measured element is the one a row is drawn in: the scale
            is pixels per second, so the row's duration follows the width. */}
        <div ref={listRef} className={LIST_PADDING_CLASS}>
          <Timeline
            timeline={timeline}
            cuts={cuts.list()}
            waveform={waveformData}
            isPlaying={isPlaying}
            isActive={activeMode === 'timeline'}
            scrollRequest={search.scrollRequest}
            highlightedSegmentId={search.highlightedSegmentId}
            onAddCut={onAddCut}
            onRestoreRange={onRestoreRange}
          />
        </div>
      </div>
    </div>
  );
}
