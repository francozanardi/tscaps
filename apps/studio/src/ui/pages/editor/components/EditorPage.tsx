import { useCallback, useMemo, useState, type ReactNode, type Ref } from 'react';
import { Captions, Check, Scissors } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';
import type { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import type { PlaybackTimeBinder } from '@presentation/editor/controllers/PlaybackTimeBinder';
import type { TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import { VideoDropzone } from '@ui/pages/editor/components/video/VideoDropzone';
import { VideoPlayer } from '@ui/pages/editor/components/video/VideoPlayer';
import { SubtitleOverlay } from '@ui/pages/editor/features/overlay/components/SubtitleOverlay';
import { SocialOverlay } from '@ui/pages/editor/features/overlay/components/SocialOverlay';
import { PreviewActorMaskOverlay } from '@ui/pages/editor/features/person-segmentation/PreviewActorMaskOverlay';
import { MaskBackfillProgressPill } from '@ui/pages/editor/features/person-segmentation/MaskBackfillProgressPill';
import { CustomVideoControls } from '@ui/pages/editor/components/playback/CustomVideoControls';
import { CaptionsPanel } from '@ui/pages/editor/components/sidebar/CaptionsPanel';
import { EditorWorkspacePane, type EditorModeDescriptor } from '@ui/pages/editor/components/EditorWorkspacePane';
import { CutsHost } from '@ui/pages/editor/features/cuts/CutsHost';
import { EditorToolbar, type SaveButtonStatus } from '@ui/pages/editor/components/EditorToolbar';
import { MobileEditorLayout } from '@ui/pages/editor/components/layout/MobileEditorLayout';
import { DesktopEditorLayout } from '@ui/pages/editor/components/layout/DesktopEditorLayout';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { SaveFailedToast } from '@ui/pages/editor/components/SaveFailedToast';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useActiveSegmentId } from '@ui/_shared/contexts/EditorStoreContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';

const MODE_ICON_SIZE = 16;

interface EditorPageProps {
  state: EditorState;
  containerRef: Ref<HTMLDivElement>;
  library: TemplateLibraryView;
  overlayController: SubtitleOverlayController;
  manipulationController: OverlayManipulationController;
  selectionController: OverlaySelectionController;
  playbackTimeBinder: PlaybackTimeBinder;
  toastOpen: boolean;
  postExportPrompt: ReactNode | null;
  exportDisabled: boolean;
  saveStatus: SaveButtonStatus;
  canSave: boolean;
  onSave: () => void;
  onDismissToast: () => void;
  onOpenExportSettings: () => void;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  videoOverlay?: ReactNode;
}

export function EditorPage({
  state,
  containerRef,
  library,
  overlayController,
  manipulationController,
  selectionController,
  playbackTimeBinder,
  toastOpen,
  postExportPrompt,
  exportDisabled,
  saveStatus,
  canSave,
  onSave,
  onDismissToast,
  onOpenExportSettings,
  onBack,
  onRenameProject,
  videoOverlay,
}: EditorPageProps) {
  const editor = useEditor();
  const cuts = useCuts();
  const sheets = useSheets();
  const playback = usePlayback();
  const { cutAwareDocumentBuilder } = cuts.services;
  const visibleDocument = useMemo(
    () => (state.document ? cutAwareDocumentBuilder.build(state.document, state.cuts) : null),
    [cutAwareDocumentBuilder, state.document, state.cuts],
  );
  const rawActiveSegmentId = useActiveSegmentId(state.document);
  const visibleActiveSegmentId = useActiveSegmentId(visibleDocument);
  const [showLayoutGuide, setShowLayoutGuide] = useState(false);
  const isVerticalVideo = state.video.layout ? state.video.layout.height > state.video.layout.width : false;

  const isMobile = useIsMobileViewport();

  // Gate export on data presence, not on `state.status`: status flips to
  // `idle` whenever a project is hydrated from the dashboard even though
  // there's a transcribed document ready to export. The original-video
  // bytes may still be streaming in — the export flow waits on the
  // download itself before kicking off the render, so the button is
  // visible whenever a document and sheets exist.
  const showExport = state.video.fileName !== null
                  && state.document !== null
                  && state.sheets.length > 0;

  // The box is explicitly sized so it doesn't collapse to the intrinsic
  // dimensions of its preview surface (a `<canvas>` capped for perf, or
  // a `<video>`). `width: 100%` fills the column and `aspect-ratio`
  // derives height from it; `max-width` caps the width so the derived
  // height never exceeds the vertical budget, keeping AR pixel-accurate
  // and preventing the flex parent from stretching one axis independently
  // of the other. The vertical budget is the layout container's height
  // (published via container-query `cqh`) minus the measured playback
  // controls (`--playback-controls-h`) and the gap between them.
  const containerStyle = state.video.layout
    ? {
        aspectRatio: `${state.video.layout.width} / ${state.video.layout.height}`,
        width: '100%',
        maxWidth: `calc((100cqh - var(--playback-controls-h, 0px) - ${isMobile ? '0.5rem' : '0.75rem'}) * ${state.video.layout.width / state.video.layout.height})`,
        maxHeight: `calc(100cqh - var(--playback-controls-h, 0px) - ${isMobile ? '0.5rem' : '0.75rem'})`,
      }
    : undefined;

  const activeSheet = state.sheets.find((s) => s.id === state.activeSheetId) ?? null;

  // Selecting a sheet seeks the video to that sheet's first segment so the
  // preview matches the active selection.
  const handleSetActiveSheet = useCallback((sheetId: string) => {
    sheets.actions.sheets.setActive.execute(sheetId);
    const doc = editor.store.snapshot().document;
    if (!doc) return;
    const first = findFirstSegmentForSheet(doc, sheetId);
    if (first) playback.seek(first.time.midpoint);
  }, [sheets, editor.store, playback]);

  const videoBox = (
    <div
      className="relative shrink min-h-0 rounded-lg overflow-hidden shadow-md bg-surface-1"
      style={containerStyle}
    >
      <VideoPlayer containerRef={containerRef} video={state.video} onClick={playback.togglePlay} />
      <MaskBackfillProgressPill />
      {showLayoutGuide && isVerticalVideo && <SocialOverlay />}
      {visibleDocument && state.video.layout && state.sheets.length > 0 && (
        <SubtitleOverlay
          overlayController={overlayController}
          manipulationController={manipulationController}
          selectionController={selectionController}
          document={visibleDocument}
          sheets={state.sheets}
          wordStyleOverrides={state.wordStyleOverrides}
          segmentOverrides={state.segmentOverrides}
          decorationOverrides={state.decorationOverrides}
          videoDuration={state.video.duration}
          videoOverlay={videoOverlay}
          occlusionOverlay={<PreviewActorMaskOverlay />}
        />
      )}
    </div>
  );

  const playbackControls = state.document && (
    <div className="w-full shrink-0">
      <CustomVideoControls
        playbackTimeBinder={playbackTimeBinder}
        isPlaying={state.video.isPlaying}
        volume={state.video.volume}
        playbackRate={state.video.playbackRate}
        showLayoutGuide={showLayoutGuide}
        showLayoutGuideToggle={isVerticalVideo}
        onLayoutGuideChange={setShowLayoutGuide}
      />
    </div>
  );

  const captionsPanel = (
    <CaptionsPanel
      sheets={state.sheets}
      activeSheet={activeSheet}
      templates={state.availableTemplates}
      library={library}
      document={state.document}
      activeSegmentId={visibleActiveSegmentId}
      wordStyleOverrides={state.wordStyleOverrides}
      segmentOverrides={state.segmentOverrides}
      decorationOverrides={state.decorationOverrides}
      videoDuration={state.video.duration}
      isPlaying={state.video.isPlaying}
      error={state.error}
      isMobileDevice={isMobile}
      onSetActiveSheet={handleSetActiveSheet}
      onCreateSheet={(name) => sheets.actions.sheets.create.execute(name)}
      onRenameSheet={(id, name) => sheets.actions.sheets.rename.execute(id, name)}
      onDeleteSheet={(id) => sheets.actions.sheets.delete.execute(id)}
      onCopyStylesFromSheet={(targetId, sourceId) => sheets.actions.sheets.copyStylesFromSheet.execute(targetId, sourceId)}
    />
  );

  const workspaceModes: readonly EditorModeDescriptor[] = [
    { id: 'captions', label: 'Captions', icon: <Captions size={MODE_ICON_SIZE} />, panel: captionsPanel },
    { id: 'cuts',     label: 'Cuts',     icon: <Scissors size={MODE_ICON_SIZE} />, panel: (
      <CutsHost
        document={state.document}
        videoFile={state.video.file}
        videoDurationSec={state.video.duration}
        cuts={state.cuts}
        activeSegmentId={rawActiveSegmentId}
        isPlaying={state.video.isPlaying}
        onSeek={playback.seek}
        onPause={playback.pause}
        onScheduleAudioMuteAt={playback.scheduleAudioMuteAt}
        onCancelScheduledAudioMute={playback.cancelScheduledAudioMute}
        onAddCut={(range) => cuts.actions.add.execute(range)}
        onRestoreRange={(range) => cuts.actions.restoreRange.execute(range)}
        onResizeCut={(originalRange, newRange) => cuts.actions.resize.execute(originalRange, newRange)}
        onClearAllCuts={() => cuts.actions.clearAll.execute()}
        onRemoveSilences={(silences) => cuts.actions.removeSilences.execute(silences)}
        onRemoveBadTakes={(ranges) => cuts.actions.removeBadTakes.execute(ranges)}
      />
    ) },
  ];

  const sidebar = <EditorWorkspacePane modes={workspaceModes} />;

  return (
    <main className="flex flex-col items-center justify-center h-dvh overflow-hidden px-3 py-2 lg:px-6 lg:py-4">
      {!state.video.url && !state.video.previewFile ? (
        <VideoDropzone onFile={(file) => editor.actions.video.load.execute(file)} />
      ) : (
        <div className={`flex flex-col w-full flex-1 min-h-0 items-center ${!state.document ? 'hidden' : ''}`}>
        <EditorToolbar
          canUndo={state.canUndo}
          canRedo={state.canRedo}
          showExport={showExport}
          exportDisabled={exportDisabled}
          onOpenExportSettings={onOpenExportSettings}
          projectName={state.projectName}
          canRename={state.projectId !== null}
          onRenameProject={onRenameProject}
          onBack={onBack}
          dirty={state.dirty}
          saveStatus={saveStatus}
          canSave={canSave}
          onSave={onSave}
        />
        {isMobile ? (
          <MobileEditorLayout
            videoBox={videoBox}
            playbackControls={playbackControls}
            sidebar={sidebar}
            videoAspectRatio={state.video.layout ? state.video.layout.width / state.video.layout.height : null}
          />
        ) : (
          <DesktopEditorLayout
            videoBox={videoBox}
            playbackControls={playbackControls}
            sidebar={sidebar}
          />
        )}
        </div>
      )}
      {postExportPrompt && toastOpen ? postExportPrompt : (
        <Toast
          open={toastOpen}
          position="top-center"
          tone="success"
          icon={<Check size={16} strokeWidth={2.5} />}
          title="Export complete"
          description="Your video was saved to disk."
          onDismiss={onDismissToast}
        />
      )}
      <SaveFailedToast error={state.error} />
    </main>
  );
}

function findFirstSegmentForSheet(doc: Document, sheetId: string): Segment | null {
  for (const section of doc.sections) {
    if (section.kind !== sheetId) continue;
    if (section.segments.length > 0) return section.segments[0]!;
  }
  return null;
}
