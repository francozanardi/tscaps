import { useCallback, useState, type ReactNode, type Ref } from 'react';
import { Check } from 'lucide-react';
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
import { CustomVideoControls } from '@ui/pages/editor/components/playback/CustomVideoControls';
import { EditorSidebar } from '@ui/pages/editor/components/sidebar/EditorSidebar';
import { EditorToolbar, type SaveButtonStatus } from '@ui/pages/editor/components/EditorToolbar';
import { MobileEditorLayout } from '@ui/pages/editor/components/layout/MobileEditorLayout';
import { DesktopEditorLayout } from '@ui/pages/editor/components/layout/DesktopEditorLayout';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { SaveFailedToast } from '@ui/pages/editor/components/SaveFailedToast';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useActiveSegmentId } from '@ui/_shared/contexts/EditorStoreContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';

interface EditorPageProps {
  state: EditorState;
  videoRef: Ref<HTMLVideoElement>;
  library: TemplateLibraryView;
  overlayController: SubtitleOverlayController;
  manipulationController: OverlayManipulationController;
  selectionController: OverlaySelectionController;
  playbackTimeBinder: PlaybackTimeBinder;
  toastOpen: boolean;
  exportRunning: boolean;
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
  videoRef,
  library,
  overlayController,
  manipulationController,
  selectionController,
  playbackTimeBinder,
  toastOpen,
  exportRunning,
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
  const sheets = useSheets();
  const playback = usePlayback();
  const activeSegmentId = useActiveSegmentId();
  const [showLayoutGuide, setShowLayoutGuide] = useState(false);
  const isVerticalVideo = state.video.layout ? state.video.layout.height > state.video.layout.width : false;

  const isMobile = useIsMobileViewport();

  // Gate export on data presence, not on `state.status`: status flips to
  // `idle` whenever a project is hydrated from the dashboard even though
  // there's a transcribed document ready to export.
  const showExport = state.video.file !== null
                  && state.document !== null
                  && state.sheets.length > 0;

  // Sum of toolbar + page chrome + controls reserved off `100vh`. When
  // those change, this is the single lever for desktop.
  const VIDEO_CHROME_REM = 9;
  const containerStyle = state.video.layout
    ? (isMobile
        ? {
            // Mobile: the parent (video region) has explicit dynamic height
            // driven by the bottom-sheet snap; the video fills it while
            // honoring the source aspect ratio.
            aspectRatio: `${state.video.layout.width} / ${state.video.layout.height}`,
            maxHeight: '100%',
            maxWidth: '100%',
          }
        : {
            aspectRatio: `${state.video.layout.width} / ${state.video.layout.height}`,
            maxWidth: `calc((100vh - ${VIDEO_CHROME_REM}rem) * ${state.video.layout.width / state.video.layout.height})`,
            maxHeight: `calc(100vh - ${VIDEO_CHROME_REM}rem)`,
          })
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
      <VideoPlayer videoRef={videoRef} video={state.video} onClick={playback.togglePlay} />
      {showLayoutGuide && isVerticalVideo && <SocialOverlay />}
      {state.document && state.video.layout && state.sheets.length > 0 && (
        <SubtitleOverlay
          overlayController={overlayController}
          manipulationController={manipulationController}
          selectionController={selectionController}
          document={state.document}
          sheets={state.sheets}
          wordStyleOverrides={state.wordStyleOverrides}
          segmentOverrides={state.segmentOverrides}
          decorationOverrides={state.decorationOverrides}
          videoDuration={state.video.duration}
          videoOverlay={videoOverlay}
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

  const sidebar = (
    <EditorSidebar
      sheets={state.sheets}
      activeSheet={activeSheet}
      templates={state.availableTemplates}
      library={library}
      document={state.document}
      activeSegmentId={activeSegmentId}
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

  return (
    <main className="flex flex-col items-center justify-center h-dvh overflow-hidden px-3 py-2 lg:px-6 lg:py-4">
      {!state.video.url ? (
        <VideoDropzone onFile={(file) => editor.actions.video.load.execute(file)} />
      ) : (
        <div className={`flex flex-col w-full flex-1 min-h-0 items-center ${!state.document ? 'hidden' : ''}`}>
        <EditorToolbar
          canUndo={state.canUndo}
          canRedo={state.canRedo}
          showExport={showExport}
          exportDisabled={exportRunning}
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
      <Toast
        open={toastOpen}
        position="top-center"
        tone="success"
        icon={<Check size={16} strokeWidth={2.5} />}
        title="Export complete"
        description="Your video was saved to disk."
        onDismiss={onDismissToast}
      />
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
