import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { PlaybackActions } from '@ui/editor/EditorPageActions';
import type { TemplateLibraryStore, TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';
import { VideoController } from '@presentation/editor/controllers/VideoController';
import { VideoKeyboardController } from '@presentation/editor/controllers/VideoKeyboardController';
import { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';
import { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { PlaybackTimeBinder } from '@presentation/editor/controllers/PlaybackTimeBinder';
import { MainVideoStreamCaptureController } from '@presentation/editor/controllers/MainVideoStreamCaptureController';
import { WordStyleBaselineResolver } from '@presentation/editor/services/WordStyleBaselineResolver';
import { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { FontSizeBounds } from '@presentation/editor/services/FontSizeBounds';
import { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import { EditorPage } from '@ui/editor/components/EditorPage';
import { LeaveWithUnsavedChangesDialog } from '@ui/editor/components/dialogs/LeaveWithUnsavedChangesDialog';
import { EditorStoreProvider } from '@ui/_shared/contexts/EditorStoreContext';
import { WordStyleBaselineProvider } from '@ui/editor/contexts/WordStyleBaselineContext';
import { SheetOverlayArtifactsProvider } from '@ui/editor/contexts/SheetOverlayArtifactsContext';
import { TemplatePreviewArtifactsProvider } from '@ui/editor/contexts/TemplatePreviewArtifactsContext';
import { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';
import { TemplatePreviewArtifactsBuilder } from '@presentation/editor/services/TemplatePreviewArtifactsBuilder';
import { MainVideoStreamProvider } from '@ui/_shared/contexts/MainVideoStreamContext';
import { PlaybackProvider } from '@ui/editor/PlaybackContext';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useTemplates } from '@ui/_shared/contexts/modules/TemplatesContext';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useExportFeedback } from '@ui/editor/ExportFeedbackContext';
import type { SaveButtonStatus } from '@ui/editor/components/toolbar/EditorToolbar';

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

interface EditorHostProps {
  onOpenExportSettings: () => void;
  onBack: () => void;
}

export function EditorHost({
  onOpenExportSettings,
  onBack,
}: EditorHostProps) {
  const editor = useEditor();
  const sheets = useSheets();
  const projects = useProjects();
  const templates = useTemplates();
  const exports = useExport();
  const exportFeedback = useExportFeedback();
  const { svgFilterDefinitionsResolver, sheetCssVarsBuilder, typographyCssVarBuilder, rotationCssVarBuilder, styleValuesCssVarsBuilder } = useRendering();
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
      editor.actions.words.setStyleOverride,
      editor.actions.words.clearAlignmentOverride,
      editor.actions.segments.setStyleOverride,
      new SnapZoneResolver(),
      new DragGeometryResolver(),
      new ResizeGeometryResolver(),
      new RotationGeometryResolver(),
      new FontSizeBounds(),
      new DragTransformPainter(),
      new NextClickSuppressor(),
      selectionController,
    ),
    [store, sheets, editor, selectionController],
  );
  useEffect(() => {
    manipulationController.start();
    return () => manipulationController.stop();
  }, [manipulationController]);
  const wordStyleBaselineResolver = useMemo(() => new WordStyleBaselineResolver(), []);
  const sheetOverlayArtifactsBuilder = useMemo(
    () => new SheetOverlayArtifactsBuilder(sheetCssVarsBuilder, svgFilterDefinitionsResolver),
    [sheetCssVarsBuilder, svgFilterDefinitionsResolver],
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
  const controllerRef = useRef<VideoController | null>(null);
  const keyboardRef = useRef<VideoKeyboardController | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [mainVideoStream, setMainVideoStream] = useState<MediaStream | null>(null);

  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    controllerRef.current?.stop();
    keyboardRef.current?.stop();
    controllerRef.current = null;
    keyboardRef.current = null;
    setVideoEl(el);
    if (!el) return;
    const controller = new VideoController(el, store);
    const keyboard = new VideoKeyboardController(controller);
    controllerRef.current = controller;
    keyboardRef.current = keyboard;
    controller.start();
    keyboard.start();
  }, [store]);

  const needsLiveStream = useMemo(
    () => state.sheets.some((s) => s.template.rendering.videoFrame.previewMode === 'live'),
    [state.sheets],
  );

  useEffect(() => {
    if (!videoEl || !needsLiveStream) {
      setMainVideoStream(null);
      return;
    }
    const capture = new MainVideoStreamCaptureController(videoEl);
    const update = () => setMainVideoStream(capture.getStream());
    capture.addEventListener('change', update);
    capture.start();
    update();
    return () => {
      capture.removeEventListener('change', update);
      capture.stop();
    };
  }, [videoEl, needsLiveStream]);

  // The playback callbacks read the ref lazily so they stay stable
  // across renders even though the `VideoController` instance is
  // re-created whenever the `<video>` element remounts.
  const playback = useMemo<PlaybackActions>(() => ({
    togglePlay: () => controllerRef.current?.togglePlay(),
    seek: (time: number) => controllerRef.current?.seek(time),
    setVolume: (vol: number) => controllerRef.current?.setVolume(vol),
    setPlaybackRate: (rate: number) => controllerRef.current?.setPlaybackRate(rate),
    prevFrame: () => controllerRef.current?.prevFrame(),
    nextFrame: () => controllerRef.current?.nextFrame(),
    prevWord: () => controllerRef.current?.prevWord(),
    nextWord: () => controllerRef.current?.nextWord(),
    prevSegment: () => controllerRef.current?.prevSegment(),
    nextSegment: () => controllerRef.current?.nextSegment(),
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
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus('error');
    }
  }, [projects]);

  const hasVideoLoaded = state.video.file !== null;
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
          <WordStyleBaselineProvider value={wordStyleBaselineResolver}>
           <SheetOverlayArtifactsProvider value={sheetOverlayArtifactsBuilder}>
            <TemplatePreviewArtifactsProvider value={templatePreviewArtifactsBuilder}>
            <EditorPage
              state={state}
              videoRef={videoRef}
              library={library}
              overlayController={overlayController}
              manipulationController={manipulationController}
              selectionController={selectionController}
              playbackTimeBinder={playbackTimeBinder}
              toastOpen={toastOpen}
              exportRunning={exportRunning}
              saveStatus={saveStatus}
              canSave={canSave}
              onSave={handleSave}
              onDismissToast={dismissToast}
              onOpenExportSettings={onOpenExportSettings}
              onBack={requestBack}
              onRenameProject={renameProject}
              videoOverlay={videoOverlay}
            />
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
        </MainVideoStreamProvider>
      </PlaybackProvider>
    </EditorStoreProvider>
  );
}

