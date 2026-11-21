import { TagConditionParser } from '@tscaps/engine';
import '@styles/tokens.css';
import '@styles/globals.css';
import '@styles/fonts.css';
import { ActiveSheetAutoSwitcher } from '@core/editor/automations/ActiveSheetAutoSwitcher';
import type { ReactElement } from 'react';
import { EditorApp } from '@bootstrap/editor/EditorApp';
import { BlockedEditorApp } from '@bootstrap/editor/BlockedEditorApp';
import { bootEngine } from '@bootstrap/wiring/engine';
import { bootBrowserSupport } from '@bootstrap/wiring/browser-support';
import { bootEditor, bootEditorStore } from '@bootstrap/wiring/editor';
import { bootCaptions } from '@bootstrap/wiring/captions';
import { bootElements } from '@bootstrap/wiring/elements';
import { bootCuts } from '@bootstrap/wiring/cuts';
import { bootOutputFrame } from '@bootstrap/wiring/output-frame';
import { bootColorGrade } from '@bootstrap/wiring/color-grade';
import { bootReviewNotes } from '@bootstrap/wiring/review-notes';
import { bootShots } from '@bootstrap/wiring/shots';
import { bootGraphicPresets, buildGraphicPlayers, buildSavedGraphicPresetsIndexedDbStoreDefinition } from '@bootstrap/wiring/graphics';
import { bootAudioMix } from '@bootstrap/wiring/audio-mix';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { bootMedia, buildMediaIndexedDbStoreDefinitions } from '@bootstrap/wiring/media';
import { ProjectDependentStores } from '@core/_shared/infrastructure/ProjectDependentStores';
import { IndexedDbV10ToV11Migration } from '@core/_shared/infrastructure/migrations/IndexedDbV10ToV11Migration';
import { IndexedDbV12ToV13Migration } from '@core/_shared/infrastructure/migrations/IndexedDbV12ToV13Migration';
import { bootPreview, bootPreviewSurface, buildVideoProxiesIndexedDbStoreDefinitions } from '@bootstrap/wiring/preview';
import type { PreviewSurfaceVariantPreference } from '@core/preview/domain/PreviewSurfaceVariantPreference';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import type { ReactNode } from 'react';
import type { PostExportPromptRenderer } from '@bootstrap/PostExportPromptSlotContext';
import { bootTemplates, buildTemplateFavoritesIndexedDbStoreDefinition } from '@bootstrap/wiring/templates';
import { BrowserStyleSheetFontFaceReader } from '@core/fonts/infrastructure/BrowserStyleSheetFontFaceReader';
import { DomProbeFontMetricsReader } from '@core/fonts/infrastructure/DomProbeFontMetricsReader';
import { bootFonts } from '@bootstrap/wiring/fonts';
import { bootExport } from '@bootstrap/wiring/export';
import { ExportStore } from '@core/export/store/ExportStore';
import {
  bootProjects,
  buildProjectsIndexedDbStoreDefinition,
} from '@bootstrap/wiring/projects';
import { bootVideoFiles, bootVideos, buildVideosIndexedDbStoreDefinitions } from '@bootstrap/wiring/videos';
import { bootTranscription } from '@bootstrap/wiring/transcription';
import { bootTagging } from '@bootstrap/wiring/tagging';
import { bootPreprocessing, buildPreprocessingProgressStore } from '@bootstrap/wiring/preprocessing';
import type { TranscriptionAudioLengthPolicy } from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import { NoOpTranscriptionAudioLengthPolicy } from '@core/transcription/infrastructure/NoOpTranscriptionAudioLengthPolicy';
import {
  bootPersonSegmentation,
  buildPersonSegmentationCacheIndexedDbStoreDefinitions,
} from '@bootstrap/wiring/person-segmentation';
import { bootSubjectTracking } from '@bootstrap/wiring/subject-tracking';
import { bootSheets } from '@bootstrap/wiring/sheets';
import { bootUtils, type UtilsModule } from '@bootstrap/wiring/utils';
import {
  bootUserBlobs,
  buildUserBlobsIndexedDbStoreDefinition,
} from '@bootstrap/wiring/user-blobs';
import {
  bootUserTemplates,
  buildUserTemplatesIndexedDbStoreDefinition,
} from '@bootstrap/wiring/user-templates';
import { bootAssetLibrary } from '@bootstrap/wiring/asset-library';
import { bootShortcuts } from '@bootstrap/wiring/shortcuts';
import { bootEditorOperations } from '@bootstrap/wiring/editor-operations';
import { bootAutomation } from '@bootstrap/wiring/automation';
import { bootMediaLooker } from '@bootstrap/wiring/media-looker';
import { CanvasPictureSheetComposer } from '@core/pictures/infrastructure/CanvasPictureSheetComposer';
import { SheetTemplateSaver } from '@core/editor-operations/services/SheetTemplateSaver';
import { GraphicPresetSaver } from '@core/editor-operations/services/GraphicPresetSaver';
import { HelpAnswers } from '@core/help/services/HelpAnswers';
import { bootHelpLibrary } from '@bootstrap/wiring/help';
import { AggregateTemplateRepository } from '@core/templates/infrastructure/repositories/AggregateTemplateRepository';
import { BehindActorPreviewCompatibleTemplateRepository } from '@core/templates/infrastructure/repositories/BehindActorPreviewCompatibleTemplateRepository';
import { ModeActiveTemplateRepository } from '@core/templates/infrastructure/repositories/ModeActiveTemplateRepository';
import { ModeActivityChecker } from '@core/caption-modes/services/ModeActivityChecker';
import { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';
import { ModeTemplateAvailabilityAutomation } from '@core/caption-modes/automations/ModeTemplateAvailabilityAutomation';
import { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import { bootRendering } from '@bootstrap/wiring/rendering';
import { bootRouting } from '@bootstrap/wiring/routing';
import { bootTelemetry, type TelemetryModule } from '@bootstrap/wiring/telemetry';
import { bootErrors, type ErrorsModule } from '@bootstrap/wiring/errors';
import { isProfilingEnabled, setupProfiler, instrumentExportLifecycle } from '@bootstrap/editor/profiler';
import { bootAudio } from '@bootstrap/wiring/audio';
import { exposeWordTimingProbe } from '@bootstrap/editor/wordTimingProbe';
import { IndexedDbBlockedError } from '@core/_shared/infrastructure/IndexedDbClient';
import { IndexedDbSupersededError } from '@core/_shared/infrastructure/IndexedDbSupersededError';

export interface CreateEditorAppOptions {
  readonly appVersion: string;
  /**
   * Video file to load into the editor as soon as the store is wired,
   * before the React tree is returned, so the transcribe flow opens
   * on first paint.
   */
  readonly initialVideo?: File;
  readonly previewProxyEnabled: boolean;
  readonly previewSurfacePreference: PreviewSurfaceVariantPreference;
  /** External transcriber; when omitted, picks the surface default. */
  readonly transcriber?: ConfigurableTranscriber;
  /** When false, the pipeline runs without touching the project repository. */
  readonly projectPersistenceEnabled: boolean;
  /**
   * Composes the tree without a project workspace — no dashboard, no
   * project URLs — and leaves the app for this URL instead.
   */
  readonly exitHref?: string;
  /** Replaces the built-in component that decides when preprocessing begins. */
  readonly startFlow?: ReactNode;
  /**
   * The `startFlow` asks for the video itself, so an editor opened
   * without one stays open instead of leaving for the dashboard or
   * `exitHref`. Only meaningful alongside a `startFlow` that does ask.
   */
  readonly startFlowChoosesVideo?: boolean;
  /** Replaces the built-in export success toast. Receives the dismiss callback bound to the same feedback controller the default toast uses. */
  readonly postExportPrompt?: PostExportPromptRenderer;
}

/**
 * Coordinates the editor tree's composition. Boots every feature
 * module in dependency order, pre-warms the data needed by the first
 * paint, gates on a browser-support probe (returning a blocked editor
 * app if WebCodecs or templates are unavailable), and hands the wired
 * modules to an `EditorApp` for mounting.
 *
 * Something the boot cannot reach short-circuits to a blocked dialog
 * naming what happened, rather than leaving the pre-React splash up
 * for as long as the page stays open: a concurrent tab holding an
 * older IndexedDB version blocks the upgrade indefinitely, a database
 * a newer version already upgraded refuses this page's older code,
 * and a request that gets no answer takes the same exit.
 *
 * Side-effect CSS imports run when this module is imported, so the
 * caller inherits the design tokens without separate work.
 *
 * **Composes, never constructs.** Feature classes are instantiated by
 * their own `bootX`, never here. A collaborator that needs a module
 * booted later is a reason to split that wiring into a second boot
 * function, the way `bootEditorStore` / `bootEditor` and
 * `bootVideoFiles` / `bootVideos` are split — not a reason to reach
 * for `new`.
 */
export async function createEditorApp(opts: CreateEditorAppOptions): Promise<ReactElement> {
  const errors = bootErrors();
  // Booted ahead of the rest so the failure paths below can report through telemetry.
  const utils = bootUtils({
    indexedDbStores: [
      buildProjectsIndexedDbStoreDefinition(),
      ...buildVideosIndexedDbStoreDefinitions(),
      ...buildVideoProxiesIndexedDbStoreDefinitions(),
      buildUserBlobsIndexedDbStoreDefinition(),
      ...buildMediaIndexedDbStoreDefinitions(),
      buildUserTemplatesIndexedDbStoreDefinition(),
      buildTemplateFavoritesIndexedDbStoreDefinition(),
      buildSavedGraphicPresetsIndexedDbStoreDefinition(),
      ...buildPersonSegmentationCacheIndexedDbStoreDefinitions(),
    ],
    indexedDbMigrations: [
      new IndexedDbV10ToV11Migration(),
      new IndexedDbV12ToV13Migration(),
    ],
  });
  const telemetry = bootTelemetry({
    userAgentInspector: utils.userAgentInspector,
    appVersion: opts.appVersion,
  });
  try {
    return await bootAndBuildEditorTree(opts, errors, utils, telemetry);
  } catch (err) {
    if (err instanceof IndexedDbBlockedError) {
      console.error('[boot] IndexedDB upgrade blocked by another tab:', err);
      return withRootErrorBoundary(<BlockedEditorApp reason="db-blocked" />);
    }
    if (err instanceof IndexedDbSupersededError) {
      console.error('[boot] IndexedDB is newer than this page:', err);
      return withRootErrorBoundary(<BlockedEditorApp reason="page-outdated" />);
    }
    throw err;
  }
}

async function bootAndBuildEditorTree(
  opts: CreateEditorAppOptions,
  errors: ErrorsModule,
  utils: UtilsModule,
  telemetry: TelemetryModule,
): Promise<ReactElement> {

  const profilingEnabled = isProfilingEnabled();
  if (profilingEnabled) setupProfiler();


  const routing = bootRouting({
    pathPrefix: '',
  });
  const projectDependents = new ProjectDependentStores();
  const videoFiles = bootVideoFiles({
    indexedDb: utils.indexedDb,
    blobReadabilityProbe: utils.blobReadabilityProbe,
    projectDependents,
  });
  const engine = bootEngine({ telemetry, errors });
  const audio = bootAudio();

  const editorStore = bootEditorStore({
    localStorageClient: utils.localStorageClient,
  });
  if (import.meta.env.DEV) exposeWordTimingProbe(editorStore.store);
  const templates = await bootTemplates({
    localStorageClient: utils.localStorageClient,
    indexedDb: utils.indexedDb,
    engine,
  });
  const browserSupport = await bootBrowserSupport({
    templateRepository: templates.repository,
    userAgentInspector: utils.userAgentInspector,
  });
  if (!browserSupport.supportReport.webcodecsSupported) return withRootErrorBoundary(<BlockedEditorApp reason="webcodecs" />);
  if (browserSupport.supportReport.supportedTemplateIds.size === 0) return withRootErrorBoundary(<BlockedEditorApp reason="no-templates" />);
  const userBlobs = await bootUserBlobs({
    indexedDb: utils.indexedDb,
  });
  const userTemplates = await bootUserTemplates({
    indexedDb: utils.indexedDb,
    engine,
    templates,
    templateSupportChecker: browserSupport.templateSupportChecker,
    telemetry,
  });
  // The proxy pipeline is meaningless with the surface pinned to
  // native — the `<video>` element plays the source blob verbatim
  // and no proxy is ever consumed. Under `auto` the pipeline stays
  // on and the per-source generation policy decides instead.
  const effectivePreviewProxyEnabled = opts.previewProxyEnabled && opts.previewSurfacePreference !== 'native';
  const previewSurface = bootPreviewSurface({
    store: editorStore.store,
    workerErrorMonitor: errors.workerErrorMonitor,
    previewSurfacePreference: opts.previewSurfacePreference,
  });
  const behindActorPreviewSupportChecker = new BehindActorPreviewSupportChecker(
    effectivePreviewProxyEnabled,
    editorStore.store,
  );
  const tagging = bootTagging(
  );
  // A template whose modes would take no word of the open document is
  // left out of the gallery: there it would offer only its plainest
  // captions.
  const pickerTemplateRepository = new BehindActorPreviewCompatibleTemplateRepository(
    new ModeActiveTemplateRepository(
      browserSupport.filteredTemplateRepository,
      new ModeActivityChecker(new ModeMatcherRegistry(new TagConditionParser()), editorStore.store),
    ),
    behindActorPreviewSupportChecker,
  );
  // Unfiltered: a saved project's behind-actor template is judged
  // once its preview is published, not while it deserialises.
  const templateRepository = new AggregateTemplateRepository([
    templates.repository,
    userTemplates.templateRepository,
  ]);
  const assetLibrary = bootAssetLibrary({ templates, userBlobs });
  const shortcuts = bootShortcuts({ localStorageClient: utils.localStorageClient });
  const rendering = bootRendering({
    assetLibrary,
    fontFaceCssReader: new BrowserStyleSheetFontFaceReader(),
    fontMetricsReader: new DomProbeFontMetricsReader(),
    errorReporter: errors.errorReporter,
  });
  const editor = bootEditor({
    engine,
    rendering,
    store: editorStore.store,
    transcribePreferenceRepository: editorStore.transcribePreferenceRepository,
    filteredTemplateRepository: pickerTemplateRepository,
  });
  const captions = bootCaptions({
    store: editor.store,
    deriver: editor.deriver,
    refresh: editor.refresh,
    telemetry,
  });
  const elements = bootElements({
    store: editor.store,
    refresh: editor.refresh,
    animationCatalog: rendering.animationCatalog,
    animationFieldCatalog: rendering.animationFieldCatalog,
    controlCssWriter: rendering.controlCssWriter,
    animationCssWriter: rendering.animationCssWriter,
    elementDescendantResolver: captions.services.elementDescendantResolver,
  });
  const cuts = bootCuts({
    store: editor.store,
    localStorageClient: utils.localStorageClient,
    telemetry,
    waveformExtractor: audio.services.waveformExtractor,
  });
  const preview = bootPreview({
    store: editor.store,
    indexedDb: utils.indexedDb,
    blobReadabilityProbe: utils.blobReadabilityProbe,
    previewProxyEnabled: effectivePreviewProxyEnabled,
    isMobileDevice: utils.userAgentInspector.isMobile(),
    previewSurface,
    transcodeCoordinator: engine.transcodeCoordinator,
    workerErrorMonitor: errors.workerErrorMonitor,
    telemetry,
    appNoticeChannel: errors.appNoticeChannel,
    errorClassifier: errors.errorClassifier,
    errorTelemetryDescriber: errors.errorTelemetryDescriber,
    storageFootprintProbe: utils.storageFootprintProbe,
    projectDependents,
  });
  const media = bootMedia({
    store: editor.store,
    indexedDb: utils.indexedDb,
    blobReadabilityProbe: utils.blobReadabilityProbe,
    projectDependents,
    proxyGenerator: preview.proxyGenerator,
    waveformExtractor: audio.services.waveformExtractor,
    telemetry: telemetry.telemetry,
    storageFootprintProbe: utils.storageFootprintProbe,
  });
  const outputFrame = bootOutputFrame({ store: editor.store, refresh: editor.refresh, telemetry: telemetry.telemetry });
  // One reader of what is said in the video, for the shots, the soundtrack and what a save keeps.
  const originalCaptions = new OriginalCaptionTrackReader();
  const colorGrade = bootColorGrade({ store: editor.store, telemetry: telemetry.telemetry });
  const graphicPresets = bootGraphicPresets({ indexedDb: utils.indexedDb });
  void graphicPresets.actions.hydrate.execute();
  const subjectTracking = bootSubjectTracking({
    editorStore: editor.store,
    workerErrorMonitor: errors.workerErrorMonitor,
  });
  const shots = bootShots({
    store: editor.store,
    planFollow: subjectTracking.actions.planFollow,
    originalCaptions,
    mediaAssets: media.assets,
    mediaBytes: media.bytes,
    mediaPreparer: media.preparer,
    gifPlayback: media.gifPlayback,
    mediaProxyCache: media.proxyCache,
    previewSurface: preview.surface,
    animationCatalog: rendering.animationCatalog,
    animationCssWriter: rendering.animationCssWriter,
    elementCssLayerBuilder: rendering.elementCssLayerBuilder,
    controlCssWriter: rendering.controlCssWriter,
    styledElementCatalog: elements.services.styledElementCatalog,
    footageResolvers: engine.footageResolvers,
    graphicPlayers: buildGraphicPlayers(document.body, rendering.fontFaceCssBuilder),
    graphicPresets,
    refresh: editor.refresh,
    telemetry: telemetry.telemetry,
  });
  const audioMix = bootAudioMix({
    store: editor.store,
    layerTiming: shots.services.layerTiming,
    shotPartitions: shots.services.materializer,
    originalCaptions,
    appBaseUrl: import.meta.env.BASE_URL,
    mediaBytes: media.bytes,
    audioPlayback: media.audioPlayback,
    mediaAssets: media.assets,
    previewSurface: preview.surface,
    telemetry: telemetry.telemetry,
  });
  const fonts = await bootFonts({ userBlobs });
  // ExportStore is created up here so it can feed both `projects`
  // (which resets it on project load) and `exports` (which is the
  // module that owns its mutations). `projects.actions.save` then
  // becomes a dep of `exports` for the auto-save-before-render flow,
  // which is why this two-step wiring exists.
  const exportRunStore = new ExportStore();
  const personSegmentation = bootPersonSegmentation({
    indexedDb: utils.indexedDb,
    editorStore: editor.store,
    refresh: editor.refresh,
    previewSupportChecker: behindActorPreviewSupportChecker,
    pickerTemplateRepository,
    workerErrorMonitor: errors.workerErrorMonitor,
    telemetry,
    appNoticeChannel: errors.appNoticeChannel,
    errorClassifier: errors.errorClassifier,
    errorTelemetryDescriber: errors.errorTelemetryDescriber,
    storageFootprintProbe: utils.storageFootprintProbe,
    projectDependents,
    footageCoverage: shots.services.layerCoverage,
    profilingEnabled,
  });
  const projects = bootProjects({
    templateRepository,
    behindActorFallbackTemplates: pickerTemplateRepository,
    behindActorSupportChecker: behindActorPreviewSupportChecker,
    store: editor.store,
    exportStore: exportRunStore,
    refresh: editor.refresh,
    templateSupportChecker: browserSupport.templateSupportChecker,
    styledElementCatalog: elements.services.styledElementCatalog,
    controlCssWriter: rendering.controlCssWriter,
    animationCssWriter: rendering.animationCssWriter,
    animationCssBuilder: rendering.animationCssBuilder,
    indexedDb: utils.indexedDb,
    videoFiles,
    preview,
    personSegmentationCacheRepository: personSegmentation.cacheRepository,
    loadMediaAssets: media.actions.load,
    mediaAssets: media.assets,
    originalCaptions,
    mediaUploader: media.uploader,
    telemetry,
    appNoticeChannel: errors.appNoticeChannel,
    errorClassifier: errors.errorClassifier,
    errorTelemetryDescriber: errors.errorTelemetryDescriber,
    storageFootprintProbe: utils.storageFootprintProbe,
    fileDownloader: utils.fileDownloader,
  });
  const videos = bootVideos({
    store: editor.store,
    exportStore: exportRunStore,
    blobReadabilityProbe: utils.blobReadabilityProbe,
    videoFiles,
    projects,
    previewSurface,
    telemetry: telemetry.telemetry,
    videoIsUploaded: false,
  });
  const sheets = bootSheets({
    store: editor.store,
    refresh: editor.refresh,
    deriver: editor.deriver,
    templates,
    telemetry,
    animationCssBuilder: rendering.animationCssBuilder,
    animationCssWriter: rendering.animationCssWriter,
    sheetElementResolver: captions.services.sheetElementResolver,
  });
  const exports = bootExport({
    engine,
    rendering,
    sheets,
    cuts,
    utils,
    workerErrorMonitor: errors.workerErrorMonitor,
    store: editor.store,
    fonts,
    runStore: exportRunStore,
    videos,
    videoIsUploaded: false,
    saveProject: projects.actions.save,
    saveFailureReporter: projects.saveFailureReporter,
    errorTelemetryDescriber: errors.errorTelemetryDescriber,
    telemetry,
    userBlobs,
    renderContributors: [personSegmentation.exportContributor, shots.exportContributor, audioMix.exportContributor],
    stillRenderContributors: [personSegmentation.cachedExportContributor, shots.exportContributor],
    // The measurement the cached contributor reads changes as the detector publishes.
    stillRenderOutsideInputs: [personSegmentation.loadedCacheStore],
    mediaAssets: media.assets,
    graphicTelemetry: graphicPresets.telemetryDescriber,
    originalCaptions,
    overlayResolver: () => null,
  });
  const reviewNotes = bootReviewNotes({
    store: editor.store,
    frames: exports.services.frameRenderer,
    shotsMaterializer: shots.services.materializer,
  });
  const editorOperations = bootEditorOperations({
    store: editor.store,
    refresh: editor.refresh,
    originalCaptions,
    rendering,
    elements,
    captions,
    sheets,
    userTemplates,
    shots,
    media,
    audioMix,
    colorGrade,
    outputFrame,
    cuts,
    personSegmentation,
  });
  const preprocessingProgressStore = buildPreprocessingProgressStore();
  const transcription = bootTranscription({
    store: editor.store,
    audio,
    preferenceRepository: editor.transcribePreferenceRepository,
    audioDecoder: engine.audioDecoder,
    workerErrorMonitor: errors.workerErrorMonitor,
    telemetry,
    appNoticeChannel: errors.appNoticeChannel,
    errorClassifier: errors.errorClassifier,
    errorTelemetryDescriber: errors.errorTelemetryDescriber,
    storageFootprintProbe: utils.storageFootprintProbe,
    ...(opts.transcriber ? { transcriber: opts.transcriber } : {}),
  });
  const audioLengthPolicy: TranscriptionAudioLengthPolicy = new NoOpTranscriptionAudioLengthPolicy();
  const preprocessing = bootPreprocessing({
    store: editor.store,
    progressStore: preprocessingProgressStore,
    transcribe: transcription.actions.transcribe,
    untranscribedRegionsStore: transcription.untranscribedRegionsStore,
    readSubtitleFile: transcription.actions.readSubtitleFile,
    audioLengthPolicy,
    runTaggers: tagging.actions.runTaggers,
    refresh: editor.refresh,
    deriver: editor.deriver,
    preview,
    videos,
    projects,
    telemetry,
    errorClassifier: errors.errorClassifier,
    errorTelemetryDescriber: errors.errorTelemetryDescriber,
    storagePersistence: utils.storagePersistence,
    localStorageClient: utils.localStorageClient,
    userAgentInspector: utils.userAgentInspector,
    transcodeCoordinator: engine.transcodeCoordinator,
    workerErrorMonitor: errors.workerErrorMonitor,
    previewProxyEnabled: effectivePreviewProxyEnabled,
    projectPersistenceEnabled: opts.projectPersistenceEnabled,
  });
  // Automation that bridges the editor store and the sheets feature:
  // started here because it depends on both modules being ready.
  new ActiveSheetAutoSwitcher(editor.store, sheets.actions.sheets.setActive).start();
  personSegmentation.triggerAutomation.start();
  personSegmentation.cacheHydrationAutomation.start();
  personSegmentation.templateAvailabilityAutomation.start();
  new ModeTemplateAvailabilityAutomation(editor.store, pickerTemplateRepository).start();
  shots.previewAutomation.start();
  audioMix.previewAutomation.start();

  if (profilingEnabled) instrumentExportLifecycle(exports.runStore);

  await Promise.all([
    templates.favoritesHydrator.boot(),
    userBlobs.urlResolver.boot(),
    userTemplates.libraryHydrator.boot(),
  ]);

  shortcuts.actions.load.execute();

  // Started last, once everything the first listing depends on is in place.
  media.scopeFollower.start();

  // Kick off template hydration so it overlaps with the first React paint.
  void editor.actions.initialize.execute();

  if (opts.initialVideo) {
    // Every video handed in at boot comes from a landing's handoff, whose entry the next page load may remove.
    videos.handedOffFiles.remember(opts.initialVideo);
    videos.actions.load.execute(opts.initialVideo);
  }

  bootAutomation({
    session: utils.automationSession,
    store: editor.store,
    catalog: editorOperations.services.catalog,
    runner: editorOperations.services.runner,
    frames: exports.services.frameRenderer,
    exportVideo: exports.actions.run,
    exportWriters: exports.services.writerFactory,
    loadVideo: videos.actions.load,
    preprocessVideo: preprocessing.actions.preprocessVideo,
    saveProject: projects.actions.save,
    projectFiles: projects.fileEncoder,
    reframe: {
      store: editor.store,
      editorOperations,
      animationCatalog: rendering.animationCatalog,
      pictureChanges: personSegmentation.pictureChangeReader,
      originalCaptions,
      frames: exports.services.frameRenderer,
      subjectTracking,
      shotFollows: shots.actions.setFollow,
    },
    importMedia: media.actions.import,
    mediaLooker: bootMediaLooker(media, new CanvasPictureSheetComposer()),
    templateSaver: new SheetTemplateSaver(editorOperations.services.sheetRefs, userTemplates.actions.save, editorOperations.services.runner),
    graphicPresetSaver: new GraphicPresetSaver(editorOperations.services.parser, shots.actions.saveGraphicPreset),
    help: new HelpAnswers(bootHelpLibrary(shortcuts)),
    reviewNotes,
  });

  if (utils.e2eMode.isEnabled()) {
    const { attachE2EHook } = await import('@bootstrap/e2eHook');
    attachE2EHook({
      editorStore: editor.store,
      exportStore: exports.runStore,
      loadVideo: videos.actions.load,
      exportRun: exports.actions.run,
      previewSurface: preview.surface,
    });
  }

  const exitHref = opts.exitHref ?? null;

  const tree = (
    <EditorApp
      startFlow={opts.startFlow ?? null}
      startFlowChoosesVideo={opts.startFlowChoosesVideo ?? false}
      postExportPrompt={opts.postExportPrompt ?? null}
      exitHref={exitHref}
      modules={{
        engine,
        rendering,
        routing,
        editor,
        captions,
        cuts,
        shots,
        outputFrame,
        audioMix,
        colorGrade,
        reviewNotes,
        media,
        elements,
        preview,
        projects,
        videos,
        templates,
        sheets,
        transcription,
        tagging,
        preprocessing,
        personSegmentation,
        subjectTracking,
        exports,
        fonts,
        utils,
        errors,
        telemetry,
        userBlobs,
        userTemplates,
        assetLibrary,
        shortcuts,
      }}
    />
  );
  return withRootErrorBoundary(tree);
}

function withRootErrorBoundary(tree: ReactElement): ReactElement {
  return tree;
}
