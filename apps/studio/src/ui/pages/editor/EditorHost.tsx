import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { PreviewProxyDownloadStatus, PreviewProxyDownloadStore } from '@core/preview/store/PreviewProxyDownloadStore';
import { PreviewLoadFailedError } from '@core/preview/domain/errors/PreviewLoadFailedError';
import { OriginalVideoDownloadBanner } from '@ui/pages/editor/components/OriginalVideoDownloadBanner';
import type { PlaybackActions } from '@ui/pages/editor/contexts/PlaybackContext';
import type { TemplateLibraryStore, TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';
import { VideoController } from '@presentation/editor/controllers/VideoController';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';
import { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';
import { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { ElementInspectorSelectionController } from '@presentation/editor/controllers/ElementInspectorSelectionController';
import { PlaybackTimeBinder } from '@presentation/editor/controllers/PlaybackTimeBinder';
import { EditorErrorReporter } from '@presentation/editor/controllers/EditorErrorReporter';
import { VideoDurationMissingCheck } from '@presentation/editor/services/error-checks/VideoDurationMissingCheck';
import { PlaybackScreenWakeLockController } from '@presentation/editor/controllers/PlaybackScreenWakeLockController';
import { ScreenWakeLock } from '@presentation/editor/controllers/ScreenWakeLock';
import { PreviewStreamsCaptureController, type PreviewStreams } from '@presentation/editor/controllers/PreviewStreamsCaptureController';
import { ElementAlignmentResolver } from '@presentation/editor/services/ElementAlignmentResolver';
import { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import { AlignmentGeometryResolver } from '@presentation/editor/services/AlignmentGeometryResolver';
import { CaptionContentBoxMeasurer } from '@presentation/editor/services/CaptionContentBoxMeasurer';
import { OverlayChromeRepositioner } from '@presentation/editor/services/OverlayChromeRepositioner';
import { OverlayChromeRepositionerProvider } from '@ui/pages/editor/features/overlay/contexts/OverlayChromeRepositionerContext';
import { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { ElementControlRange } from '@presentation/editor/services/ElementControlRange';
import { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import { useShotLayerOverlayControllers } from '@ui/pages/editor/features/overlay/hooks/useShotLayerOverlayControllers';
import { ShotLayerOverlayProvider } from '@ui/pages/editor/features/overlay/contexts/ShotLayerOverlayContext';
import { OverlaySelectionProvider } from '@ui/pages/editor/contexts/OverlaySelectionContext';
import { EditorPage } from '@ui/pages/editor/components/EditorPage';
import { ProjectLoadingIndicator } from '@ui/pages/editor/components/ProjectLoadingIndicator';
import { ProjectBlockedDialog } from '@ui/pages/editor/components/dialogs/ProjectBlockedDialog';
import { LeaveWithUnsavedChangesDialog } from '@ui/pages/editor/components/dialogs/LeaveWithUnsavedChangesDialog';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { EditorStoreProvider } from '@ui/_shared/contexts/EditorStoreContext';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { ElementAlignmentProvider } from '@ui/pages/editor/contexts/ElementAlignmentContext';
import { usePlaybackShortcuts } from '@ui/pages/editor/hooks/usePlaybackShortcuts';
import { SheetOverlayArtifactsProvider } from '@ui/pages/editor/contexts/SheetOverlayArtifactsContext';
import { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';
import { PreviewStreamsProvider } from '@ui/_shared/contexts/PreviewStreamsContext';
import { RestingCaptionProbe } from '@presentation/editor/services/RestingCaptionProbe';
import { OverlayRestingCaptionSource } from '@presentation/editor/services/OverlayRestingCaptionSource';
import { BehindActorSegmentClassResolver } from '@presentation/editor/services/BehindActorSegmentClassResolver';
import { RestingCaptionProbeProvider } from '@ui/pages/editor/contexts/RestingCaptionProbeContext';
import { PlaybackProvider } from '@ui/pages/editor/contexts/PlaybackContext';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useTemplates } from '@ui/_shared/contexts/modules/TemplatesContext';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import { useTelemetry } from '@ui/_shared/contexts/modules/TelemetryContext';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useExportFeedback } from '@ui/pages/editor/contexts/ExportFeedbackContext';
import type { SaveButtonStatus } from '@ui/pages/editor/components/EditorToolbar';
import { usePostExportPromptSlot } from '@bootstrap/PostExportPromptSlotContext';
import { useReviewNotesSlots } from '@ui/pages/editor/features/review-notes/hooks/useReviewNotesSlots';
import { ReviewMarkingStore } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { ReviewLayoutButton } from '@ui/pages/editor/features/review-layout/ReviewLayoutButton';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import type { EditorLayout } from '@ui/pages/editor/components/EditorPage';

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

function usePreviewProxyDownloadStatus(downloadStore: PreviewProxyDownloadStore): PreviewProxyDownloadStatus {
  const [status, setStatus] = useState<PreviewProxyDownloadStatus>(() => downloadStore.status);
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
  const elements = useElements();
  const cuts = useCuts();
  const sheets = useSheets();
  const projects = useProjects();
  const templates = useTemplates();
  const exports = useExport();
  const exportFeedback = useExportFeedback();
  const { svgFilterDefinitionsResolver, sheetCssVarsBuilder, segmentPaddingCssRuleBuilder, layeredCaptionCssBuilder, horizontalPlacementResolver, segmentColorRotation, segmentProbeMarkupBuilder } = useRendering();
  useEffect(() => {
    editor.sheetScriptsAutomation.start();
    return () => editor.sheetScriptsAutomation.stop();
  }, [editor.sheetScriptsAutomation]);
  useEffect(() => {
    editor.fontArrivalAutomation.start();
    return () => editor.fontArrivalAutomation.stop();
  }, [editor.fontArrivalAutomation]);
  const store = editor.store;
  const state = useEditorState();
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
  const postExportPromptSlot = usePostExportPromptSlot();
  const exportRunning = useExportRunning(exports.runStore);
  const preview = usePreview();
  const originalVideoDownload = useOriginalVideoDownloadStatus(projects.originalVideoDownloadStore);
  const proxyDownload = usePreviewProxyDownloadStatus(preview.proxyDownloadStore);
  const originalVideoDownloadFailed = originalVideoDownload.kind === 'failed';
  const overlayController = useMemo(
    () => new SubtitleOverlayController(store, svgFilterDefinitionsResolver),
    [store, svgFilterDefinitionsResolver],
  );
  useEffect(() => {
    overlayController.start();
    return () => overlayController.stop();
  }, [overlayController]);
  const chromeRepositioner = useMemo(() => new OverlayChromeRepositioner(store), [store]);
  useEffect(() => {
    chromeRepositioner.start();
    return () => chromeRepositioner.stop();
  }, [chromeRepositioner]);
  const selectionController = useMemo(() => new OverlaySelectionController(), []);
  useEffect(() => {
    selectionController.start();
    return () => selectionController.stop();
  }, [selectionController]);
  const workspaceStore = useEditorWorkspaceStore();
  const inspectorSelectionController = useMemo(
    () => new ElementInspectorSelectionController(selectionController, workspaceStore),
    [selectionController, workspaceStore],
  );
  useEffect(() => {
    inspectorSelectionController.start();
    return () => inspectorSelectionController.stop();
  }, [inspectorSelectionController]);
  const elementAlignmentResolver = useMemo(
    () => new ElementAlignmentResolver(horizontalPlacementResolver),
    [horizontalPlacementResolver],
  );
  const manipulationController = useMemo(
    () => new OverlayManipulationController(
      store,
      sheets.actions.style.updateAlignment,
      sheets.actions.style.updateTypography,
      sheets.actions.style.updateRotation,
      elements.actions.setPlacement,
      elements.services.styledElementCatalog,
      elements.actions.setField,
      new SnapZoneResolver(),
      horizontalPlacementResolver,
      new DragGeometryResolver(),
      new AlignmentGeometryResolver(horizontalPlacementResolver),
      elementAlignmentResolver,
      sheets.linkedSheetsSync,
      new CaptionContentBoxMeasurer(),
      new ResizeGeometryResolver(),
      new RotationGeometryResolver(),
      new ElementControlRange(),
      new DragTransformPainter(),
      new NextClickSuppressor(),
      selectionController,
    ),
    [store, sheets, elements, selectionController, horizontalPlacementResolver, elementAlignmentResolver],
  );
  useEffect(() => {
    manipulationController.start();
    return () => manipulationController.stop();
  }, [manipulationController]);
  const sheetOverlayArtifactsBuilder = useMemo(
    () => new SheetOverlayArtifactsBuilder(sheetCssVarsBuilder, svgFilterDefinitionsResolver, segmentPaddingCssRuleBuilder, layeredCaptionCssBuilder),
    [sheetCssVarsBuilder, svgFilterDefinitionsResolver, segmentPaddingCssRuleBuilder, layeredCaptionCssBuilder],
  );
  const restingCaptionProbe = useMemo(
    () => new RestingCaptionProbe(
      manipulationController,
      new OverlayRestingCaptionSource(sheetOverlayArtifactsBuilder, segmentColorRotation, new BehindActorSegmentClassResolver()),
      segmentProbeMarkupBuilder,
    ),
    [manipulationController, sheetOverlayArtifactsBuilder, segmentColorRotation, segmentProbeMarkupBuilder],
  );
  const playbackTimeBinder = useMemo(() => new PlaybackTimeBinder(store), [store]);
  useEffect(() => {
    playbackTimeBinder.start();
    return () => playbackTimeBinder.stop();
  }, [playbackTimeBinder]);
  const telemetry = useTelemetry();
  const appNoticeChannel = useErrors().appNoticeChannel;
  const editorErrorChecks = useMemo(() => [new VideoDurationMissingCheck()], []);
  const editorErrorReporter = useMemo(
    () => new EditorErrorReporter(store, editorErrorChecks, telemetry, appNoticeChannel),
    [store, editorErrorChecks, telemetry, appNoticeChannel],
  );
  useEffect(() => {
    editorErrorReporter.start();
    return () => editorErrorReporter.stop();
  }, [editorErrorReporter]);
  const playbackWakeLock = useMemo(
    () => new PlaybackScreenWakeLockController(store, new ScreenWakeLock()),
    [store],
  );
  useEffect(() => {
    playbackWakeLock.start();
    return () => playbackWakeLock.stop();
  }, [playbackWakeLock]);
  const controllerRef = useRef<VideoController | null>(null);
  usePlaybackShortcuts(controllerRef);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [previewStreams, setPreviewStreams] = useState<PreviewStreams | null>(null);

  const cutAwareDocumentBuilder = cuts.services.cutAwareDocumentBuilder;
  const previewSurface = preview.surface;
  const [previewReady, setPreviewReady] = useState<boolean>(() => previewSurface.snapshot().isReady);
  // The full-page loading cover is for opening the editor. Once the preview has shown, a reload of it (a copy
  // put in place of a video that stopped reading, a file chosen again) or a failure is the player's to show:
  // covering the page would hide the editor and the way out with it.
  const [previewShownOnce, setPreviewShownOnce] = useState<boolean>(() => previewSurface.snapshot().isReady);

  useEffect(() => () => previewSurface.stop(), [previewSurface]);

  useEffect(() => {
    const update = () => {
      const { isReady } = previewSurface.snapshot();
      setPreviewReady(isReady);
      if (isReady) setPreviewShownOnce(true);
    };
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

  const videoRef = useCallback((el: HTMLDivElement | null) => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setContainerEl(el);
    if (!el) return;
    previewSurface.start(el);
    const controller = new VideoController(previewSurface, store, cutAwareDocumentBuilder);
    controllerRef.current = controller;
    controller.start();
  }, [store, cutAwareDocumentBuilder, previewSurface]);

  useEffect(() => {
    const preview = state.video.preview;
    if (!preview) {
      previewSurface.unload();
      return;
    }
    const persistedSourceTimeSec = store.snapshot().video.currentTime;
    let cancelled = false;
    (async () => {
      try {
        previewSurface.selectVariantForSource(preview.kind === 'proxy');
        await previewSurface.load(preview.file);
        if (cancelled) return;
        if (persistedSourceTimeSec > 0) previewSurface.seek(persistedSourceTimeSec);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load video into preview surface', err);
        // An original that stopped reading is looked for in its other
        // copies, and the player explains it when none answers.
        const sourceUnreadable = previewSurface.snapshot().loadFailure?.reason === 'source-unreadable';
        if (sourceUnreadable && preview.kind === 'original') return;
        store.patch({ error: new PreviewLoadFailedError({ cause: err }) });
      }
    })();
    return () => { cancelled = true; };
  }, [state.video.preview, previewSurface, store]);

  const needsLiveStream = useMemo(
    () => state.sheets.some((s) => s.template.rendering.videoFrame.previewMode === 'live'),
    [state.sheets],
  );

  // The streams are owned by an external capture controller, so the effect is
  // its lifecycle: subscribing publishes the streams, and losing the container
  // or the need for them has to publish their absence. Clearing them lazily
  // would leave dead MediaStreams in the tree for a render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!containerEl || !needsLiveStream) {
      setPreviewStreams(null);
      return;
    }
    const capture = new PreviewStreamsCaptureController(previewSurface);
    const update = () => setPreviewStreams(capture.getStreams());
    capture.addEventListener('change', update);
    capture.start();
    update();
    return () => {
      capture.removeEventListener('change', update);
      capture.stop();
    };
  }, [containerEl, needsLiveStream, previewSurface]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    scheduleStopAt: (sourceSec: number) => controllerRef.current?.scheduleStopAt(sourceSec),
    cancelScheduledStop: () => controllerRef.current?.cancelScheduledStop(),
  }), []);
  const shotLayerOverlay = useShotLayerOverlayControllers(store, selectionController, playback.pause);
  // A page an agent drives from outside opens on the review, and its notes go to that agent: the in-app assistant,
  // where there is one, stands aside.
  const { automationSession } = useUtils();
  const drivenFromOutside = automationSession.token() !== null;
  const [layout, setLayout] = useState<EditorLayout>(drivenFromOutside ? 'review' : 'full');
  const openFullEditor = useCallback(() => setLayout('full'), []);
  const reviewLayoutButton = useMemo(
    () => (drivenFromOutside ? <ReviewLayoutButton onClick={() => setLayout('review')} /> : undefined),
    [drivenFromOutside],
  );
  const reviewMarking = useMemo(() => new ReviewMarkingStore(), []);
  const reviewNotes = useReviewNotesSlots(reviewMarking, drivenFromOutside);

  const dismissToast = useCallback(() => exportFeedback.dismissToast(), [exportFeedback]);
  const postExportPrompt = useMemo(
    () => (postExportPromptSlot ? postExportPromptSlot({ onDismiss: dismissToast }) : null),
    [postExportPromptSlot, dismissToast],
  );
  const renameProject = useCallback(
    (name: string) => projects.actions.rename.execute(name),
    [projects],
  );

  const [saveStatus, setSaveStatus] = useState<SaveButtonStatus>('idle');
  useSavedStatusAutoReset(saveStatus, setSaveStatus);
  // A failed save always leaves the editor dirty, so a clean editor
  // means a later save landed the work without this button, and the
  // failure it shows is over.
  const shownSaveStatus = saveStatus === 'error' && !state.dirty ? 'idle' : saveStatus;

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await projects.actions.save.execute();
      setSaveStatus('saved');
    } catch (cause) {
      console.error('Save failed', cause);
      setSaveStatus('error');
      projects.saveFailureReporter.report(cause);
    }
  }, [projects]);

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

  const requestExport = useCallback(() => {
    onOpenExportSettings();
  }, [
    onOpenExportSettings,
  ]);

  // Asked for by something with no button to press (the assistant): the same path as the Export button.
  useEffect(() => {
    exports.dialogRequests.addEventListener('request', requestExport);
    return () => exports.dialogRequests.removeEventListener('request', requestExport);
  }, [exports, requestExport]);

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
        <PreviewStreamsProvider value={previewStreams}>
          <ElementAlignmentProvider value={elementAlignmentResolver}>
           <SheetOverlayArtifactsProvider value={sheetOverlayArtifactsBuilder}>
            <RestingCaptionProbeProvider value={restingCaptionProbe}>
            <OverlayChromeRepositionerProvider value={chromeRepositioner}>
            <OverlaySelectionProvider value={selectionController}>
            <ShotLayerOverlayProvider value={shotLayerOverlay}>
            <EditorPage
              state={state}
              containerRef={videoRef}
              library={library}
              overlayController={overlayController}
              manipulationController={manipulationController}
              selectionController={selectionController}
              playbackTimeBinder={playbackTimeBinder}
              appNoticeChannel={appNoticeChannel}
              toastOpen={toastOpen}
              postExportPrompt={postExportPrompt}
              exportDisabled={exportRunning || originalVideoDownloadFailed}
              saveStatus={shownSaveStatus}
              canSave={canSave}
              onSave={handleSave}
              onDismissToast={dismissToast}
              onOpenExportSettings={requestExport}
              onBack={requestBack}
              onRenameProject={renameProject}
              videoOverlay={videoOverlay}
              banner={originalVideoDownload.kind === 'failed'
                ? <OriginalVideoDownloadBanner error={originalVideoDownload.error} onBackToProjects={onBack} />
                : null}
              frameLayer={reviewNotes.frameLayer}
              timelineOverlay={reviewNotes.timelineOverlay}
              layout={layout}
              onOpenFullEditor={openFullEditor}
              canLeave={!drivenFromOutside}
              reviewMarking={reviewMarking}
              toolbarLeadingControl={reviewLayoutButton}
            />
            <LeaveWithUnsavedChangesDialog
              open={unsavedDialogOpen}
              saving={leaveBusy}
              onCancel={dismissUnsavedDialog}
              onLeaveWithoutSaving={leaveWithoutSaving}
              onSaveAndLeave={saveAndLeave}
            />
            </ShotLayerOverlayProvider>
            </OverlaySelectionProvider>
            </OverlayChromeRepositionerProvider>
            </RestingCaptionProbeProvider>
           </SheetOverlayArtifactsProvider>
          </ElementAlignmentProvider>
        </PreviewStreamsProvider>
      </PlaybackProvider>
      {!previewReady && !previewShownOnce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0">
          <ProjectLoadingIndicator downloadStatus={originalVideoDownload} proxyDownloadStatus={proxyDownload} />
        </div>
      )}
      {state.error?.name === 'PreviewLoadFailedError' && (
        <ProjectBlockedDialog error={state.error} onBackToProjects={onBack} />
      )}
    </EditorStoreProvider>
  );
}

