import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';
import { OriginalVideoDownloadBanner } from '@ui/pages/editor/components/OriginalVideoDownloadBanner';
import type { PlaybackActions } from '@ui/pages/editor/contexts/PlaybackContext';
import type { TemplateLibraryStore, TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';
import { VideoController } from '@presentation/editor/controllers/VideoController';
import { VideoKeyboardController } from '@presentation/editor/controllers/VideoKeyboardController';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';
import { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';
import { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { PlaybackTimeBinder } from '@presentation/editor/controllers/PlaybackTimeBinder';
import { PlaybackScreenWakeLockController } from '@presentation/editor/controllers/PlaybackScreenWakeLockController';
import { ScreenWakeLock } from '@presentation/editor/controllers/ScreenWakeLock';
import { MainVideoStreamCaptureController } from '@presentation/editor/controllers/MainVideoStreamCaptureController';
import { WordStyleBaselineResolver } from '@presentation/editor/services/WordStyleBaselineResolver';
import { KeyboardShortcutLabeler } from '@presentation/editor/services/KeyboardShortcutLabeler';
import { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { FontSizeBounds } from '@presentation/editor/services/FontSizeBounds';
import { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import { EditorPage } from '@ui/pages/editor/components/EditorPage';
import { ProjectLoadingIndicator } from '@ui/pages/editor/components/ProjectLoadingIndicator';
import { LeaveWithUnsavedChangesDialog } from '@ui/pages/editor/components/dialogs/LeaveWithUnsavedChangesDialog';
import { EditorStoreProvider } from '@ui/_shared/contexts/EditorStoreContext';
import { WordStyleBaselineProvider } from '@ui/pages/editor/contexts/WordStyleBaselineContext';
import { KeyboardShortcutLabelerProvider } from '@ui/pages/editor/contexts/KeyboardShortcutLabelerContext';
import { SheetOverlayArtifactsProvider } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';
import { TemplatePreviewArtifactsProvider } from '@ui/pages/editor/contexts/TemplatePreviewArtifactsContext';
import { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';
import { TemplatePreviewArtifactsBuilder } from '@presentation/editor/services/TemplatePreviewArtifactsBuilder';
import { MainVideoStreamProvider } from '@ui/_shared/contexts/MainVideoStreamContext';
import { PlaybackProvider } from '@ui/pages/editor/contexts/PlaybackContext';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useTemplates } from '@ui/_shared/contexts/modules/TemplatesContext';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useExportFeedback } from '@ui/pages/editor/contexts/ExportFeedbackContext';
import type { SaveButtonStatus } from '@ui/pages/editor/components/EditorToolbar';

const SAVED_PILL_VISIBLE_MS = 2_000;

/**
 * Drops a transient `saved` status back to `idle` after a short window
 * so the success pill stops nagging once the user has noticed it.
 */
function useSavedStatusAutoReset(
  status: SaveButtonStatus,
  setStatus: (next: SaveButtonStatus) => void,
): void {
  useEffect(() => {
    if (status !== 'saved') return;
    const handle = setTimeout(() => setStatus('idle'), SAVED_PILL_VISIBLE_MS);
    return () => clearTimeout(handle);
  }, [status, setStatus]);
}

function useEditorSnapshot(store: EditorStore): EditorState {
  const [state, setState] = useState(() => store.snapshot());
  useEffect(() => {
    const update = () => setState(store.snapshot());
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return state;
}

function useTemplateLibraryView(
  library: TemplateLibraryStore,
  toggleFavorite: (templateId: string) => void,
): TemplateLibraryView {
  const [snapshot, setSnapshot] = useState(() => library.snapshot());
  useEffect(() => {
    const update = () => setSnapshot(library.snapshot());
    library.addEventListener('change', update);
    update();
    return () => library.removeEventListener('change', update);
  }, [library]);
  const toggle = useCallback((id: string) => toggleFavorite(id), [toggleFavorite]);
  return { ...snapshot, toggleFavorite: toggle };
}

function useExportToast(feedback: ExportFeedbackController): boolean {
  const [open, setOpen] = useState<boolean>(() => feedback.toastOpen);
  useEffect(() => {
    const update = () => setOpen(feedback.toastOpen);
    feedback.addEventListener('change', update);
    update();
    return () => feedback.removeEventListener('change', update);
  }, [feedback]);
  return open;
}

function useExportRunning(exportStore: ExportStore): boolean {
  const [running, setRunning] = useState<boolean>(() => exportStore.run !== null);
  useEffect(() => {
    const update = () => {
      const next = exportStore.run !== null;
      setRunning((prev) => (prev === next ? prev : next));
    };
    exportStore.addEventListener('change', update);
    update();
    return () => exportStore.removeEventListener('change', update);
  }, [exportStore]);
  return running;
}

function useOriginalVideoDownloadStatus(downloadStore: OriginalVideoDownloadStore): OriginalVideoDownloadStatus {
  const [status, setStatus] = useState<OriginalVideoDownloadStatus>(() => downloadStore.status);
  useEffect(() => {
    const update = () => setStatus(downloadStore.status);
    downloadStore.addEventListener('change', update);
    update();
    return () => downloadStore.removeEventListener('change', update);
  }, [downloadStore]);
  return status;
}

interface EditorHostProps {
  onOpenExportSettings: () => void;
  onBack: () => void;
}

export function EditorHost({
  onOpenExportSettings,
  onBack,
}: EditorHostProps) {
  const editor = useEditor();
  const captions = useCaptions();
  const cuts = useCuts();
  const sheets = useSheets();
  const projects = useProjects();
  const templates = useTemplates();
  const exports = useExport();
  const exportFeedback = useExportFeedback();
  const { svgFilterDefinitionsResolver, sheetCssVarsBuilder, segmentPaddingCssRuleBuilder, typographyCssVarBuilder, rotationCssVarBuilder, styleValuesCssVarsBuilder } = useRendering();
  const store = editor.store;
  const state = useEditorSnapshot(store);
  const toggleTemplateFavorite = useCallback(
    (id: string) => {
      templates.actions.toggleFavorite.execute(id).catch((err) => {
        console.error('Toggle template favorite failed', err);
      });
    },
    [templates],
  );
  const library = useTemplateLibraryView(templates.library, toggleTemplateFavorite);
  const toastOpen = useExportToast(exportFeedback);
  const exportRunning = useExportRunning(exports.runStore);
  const originalVideoDownload = useOriginalVideoDownloadStatus(projects.originalVideoDownloadStore);
  const originalVideoDownloadFailed = originalVideoDownload.kind === 'failed';
  const overlayController = useMemo(
    () => new SubtitleOverlayController(store, svgFilterDefinitionsResolver),
    [store, svgFilterDefinitionsResolver],
  );
  useEffect(() => {
    overlayController.start();
    return () => overlayController.stop();
  }, [overlayController]);
  const selectionController = useMemo(() => new OverlaySelectionController(), []);
  useEffect(() => {
    selectionController.start();
    return () => selectionController.stop();
  }, [selectionController]);
  const manipulationController = useMemo(
    () => new OverlayManipulationController(
      store,
      sheets.actions.style.updateAlignment,
      sheets.actions.style.updateTypography,
      sheets.actions.style.updateRotation,
      captions.actions.words.setStyleOverride,
      captions.actions.words.clearAlignmentOverride,
      captions.actions.segments.setStyleOverride,
      new SnapZoneResolver(),
      new DragGeometryResolver(),
      new ResizeGeometryResolver(),
      new RotationGeometryResolver(),
      new FontSizeBounds(),
      new DragTransformPainter(),
      new NextClickSuppressor(),
      selectionController,
    ),
    [store, sheets, captions, selectionController],
  );
  useEffect(() => {
    manipulationController.start();
    return () => manipulationController.stop();
  }, [manipulationController]);
  const wordStyleBaselineResolver = useMemo(() => new WordStyleBaselineResolver(), []);
  const keyboardShortcutLabeler = useMemo(() => new KeyboardShortcutLabeler(), []);
  const sheetOverlayArtifactsBuilder = useMemo(
    () => new SheetOverlayArtifactsBuilder(sheetCssVarsBuilder, svgFilterDefinitionsResolver, segmentPaddingCssRuleBuilder),
    [sheetCssVarsBuilder, svgFilterDefinitionsResolver, segmentPaddingCssRuleBuilder],
  );
  const templatePreviewArtifactsBuilder = useMemo(
    () => new TemplatePreviewArtifactsBuilder(typographyCssVarBuilder, rotationCssVarBuilder, styleValuesCssVarsBuilder),
    [typographyCssVarBuilder, rotationCssVarBuilder, styleValuesCssVarsBuilder],
  );
  const playbackTimeBinder = useMemo(() => new PlaybackTimeBinder(store), [store]);
  useEffect(() => {
    playbackTimeBinder.start();
    return () => playbackTimeBinder.stop();
  }, [playbackTimeBinder]);
  const playbackWakeLock = useMemo(
    () => new PlaybackScreenWakeLockController(store, new ScreenWakeLock()),
    [store],
  );
  useEffect(() => {
    playbackWakeLock.start();
    return () => playbackWakeLock.stop();
  }, [playbackWakeLock]);
  const controllerRef = useRef<VideoController | null>(null);
  const keyboardRef = useRef<VideoKeyboardController | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [mainVideoStream, setMainVideoStream] = useState<MediaStream | null>(null);

  const cutAwareDocumentBuilder = cuts.services.cutAwareDocumentBuilder;
  const previewSurface = usePreview().surface;
  const [previewReady, setPreviewReady] = useState<boolean>(() => previewSurface.snapshot().isReady);

  useEffect(() => () => previewSurface.stop(), [previewSurface]);

  useEffect(() => {
    const update = () => setPreviewReady(previewSurface.snapshot().isReady);
    previewSurface.addEventListener('change', update);
    update();
    return () => previewSurface.removeEventListener('change', update);
  }, [previewSurface]);

  useEffect(() => {
    if (previewReady) return;
    const wakeLock = new ScreenWakeLock();
    wakeLock.start();
    return () => wakeLock.stop();
  }, [previewReady]);

  const videoRef = useCallback((el: HTMLCanvasElement | null) => {
    controllerRef.current?.stop();
    keyboardRef.current?.stop();
    controllerRef.current = null;
    keyboardRef.current = null;
    setCanvasEl(el);
    if (!el) return;
    previewSurface.start(el);
    const controller = new VideoController(previewSurface, store, cutAwareDocumentBuilder);
    const keyboard = new VideoKeyboardController(controller);
    controllerRef.current = controller;
    keyboardRef.current = keyboard;
    controller.start();
    keyboard.start();
  }, [store, cutAwareDocumentBuilder, previewSurface]);

  useEffect(() => {
    const previewSource = state.video.previewFile;
    if (!previewSource) {
      previewSurface.unload();
      return;
    }
    const persistedSourceTimeSec = store.snapshot().video.currentTime;
    let cancelled = false;
    (async () => {
      try {
        await previewSurface.load(previewSource);
        if (cancelled) return;
        if (persistedSourceTimeSec > 0) previewSurface.seek(persistedSourceTimeSec);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load video into preview surface', err);
      }
    })();
    return () => { cancelled = true; };
  }, [state.video.previewFile, previewSurface, store]);

  const needsLiveStream = useMemo(
    () => state.sheets.some((s) => s.template.rendering.videoFrame.previewMode === 'live'),
    [state.sheets],
  );

  useEffect(() => {
    if (!canvasEl || !needsLiveStream) {
      setMainVideoStream(null);
      return;
    }
    const capture = new MainVideoStreamCaptureController(canvasEl);
    const update = () => setMainVideoStream(capture.getStream());
    capture.addEventListener('change', update);
    capture.start();
    update();
    return () => {
      capture.removeEventListener('change', update);
      capture.stop();
    };
  }, [canvasEl, needsLiveStream]);

  const playback = useMemo<PlaybackActions>(() => ({
    togglePlay: () => controllerRef.current?.togglePlay(),
    play: () => controllerRef.current?.play(),
    pause: () => controllerRef.current?.pause(),
    seek: (time: number) => controllerRef.current?.seek(time),
    beginScrub: () => controllerRef.current?.beginScrub(),
    endScrub: () => controllerRef.current?.endScrub(),
    setVolume: (vol: number) => controllerRef.current?.setVolume(vol),
    setPlaybackRate: (rate: number) => controllerRef.current?.setPlaybackRate(rate),
    prevFrame: () => controllerRef.current?.prevFrame(),
    nextFrame: () => controllerRef.current?.nextFrame(),
    prevWord: () => controllerRef.current?.prevWord(),
    nextWord: () => controllerRef.current?.nextWord(),
    prevSegment: () => controllerRef.current?.prevSegment(),
    nextSegment: () => controllerRef.current?.nextSegment(),
    scheduleAudioMuteAt: (sourceSec: number) => controllerRef.current?.scheduleAudioMuteAt(sourceSec),
    cancelScheduledAudioMute: () => controllerRef.current?.cancelScheduledAudioMute(),
  }), []);

  const dismissToast = useCallback(() => exportFeedback.dismissToast(), [exportFeedback]);
  const renameProject = useCallback(
    (name: string) => projects.actions.rename.execute(name),
    [projects],
  );

  const [saveStatus, setSaveStatus] = useState<SaveButtonStatus>('idle');
  useSavedStatusAutoReset(saveStatus, setSaveStatus);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await projects.actions.save.execute();
      setSaveStatus('saved');
    } catch (cause) {
      console.error('Save failed', cause);
      setSaveStatus('error');
      store.patch({ error: new ProjectSaveFailedError({ cause }) });
    }
  }, [projects, store]);

  const hasVideoLoaded = state.video.fileName !== null;
  const canSave = state.projectId !== null && hasVideoLoaded;
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const requestBack = useCallback(() => {
    if (state.dirty) {
      setUnsavedDialogOpen(true);
      return;
    }
    onBack();
  }, [
    state.dirty,
    onBack,
  ]);

  const dismissUnsavedDialog = useCallback(() => setUnsavedDialogOpen(false), []);

  const leaveWithoutSaving = useCallback(() => {
    setUnsavedDialogOpen(false);
    onBack();
  }, [onBack]);

  const saveAndLeave = useCallback(async () => {
    setLeaveBusy(true);
    setSaveStatus('saving');
    try {
      await projects.actions.save.execute();
      setSaveStatus('saved');
      setUnsavedDialogOpen(false);
      onBack();
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus('error');
    } finally {
      setLeaveBusy(false);
    }
  }, [projects, onBack]);

  const videoOverlay = undefined;

  return (
    <EditorStoreProvider value={store}>
      <PlaybackProvider value={playback}>
        <MainVideoStreamProvider value={mainVideoStream}>
         <KeyboardShortcutLabelerProvider value={keyboardShortcutLabeler}>
          <WordStyleBaselineProvider value={wordStyleBaselineResolver}>
           <SheetOverlayArtifactsProvider value={sheetOverlayArtifactsBuilder}>
            <TemplatePreviewArtifactsProvider value={templatePreviewArtifactsBuilder}>
            <EditorPage
              state={state}
              canvasRef={videoRef}
              library={library}
              overlayController={overlayController}
              manipulationController={manipulationController}
              selectionController={selectionController}
              playbackTimeBinder={playbackTimeBinder}
              toastOpen={toastOpen}
              exportDisabled={exportRunning || originalVideoDownloadFailed}
              saveStatus={saveStatus}
              canSave={canSave}
              onSave={handleSave}
              onDismissToast={dismissToast}
              onOpenExportSettings={onOpenExportSettings}
              onBack={requestBack}
              onRenameProject={renameProject}
              videoOverlay={videoOverlay}
            />
            {originalVideoDownloadFailed && <OriginalVideoDownloadBanner onBackToProjects={onBack} />}
            <LeaveWithUnsavedChangesDialog
              open={unsavedDialogOpen}
              saving={leaveBusy}
              onCancel={dismissUnsavedDialog}
              onLeaveWithoutSaving={leaveWithoutSaving}
              onSaveAndLeave={saveAndLeave}
            />
            </TemplatePreviewArtifactsProvider>
           </SheetOverlayArtifactsProvider>
          </WordStyleBaselineProvider>
         </KeyboardShortcutLabelerProvider>
        </MainVideoStreamProvider>
      </PlaybackProvider>
      {!previewReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0">
          <ProjectLoadingIndicator downloadStatus={originalVideoDownload} />
        </div>
      )}
    </EditorStoreProvider>
  );
}

