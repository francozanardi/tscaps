import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import { BehindActorContributionBuilder } from '@core/person-segmentation/services/BehindActorContributionBuilder';
import { BehindActorExportContributor } from '@core/person-segmentation/services/BehindActorExportContributor';
import { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import { CancelPersonSegmentationAction } from '@core/person-segmentation/actions/CancelPersonSegmentationAction';
import { AnalyzeVideoRangesAction } from '@core/person-segmentation/actions/AnalyzeVideoRangesAction';
import { StartBehindActorAnalysisAction } from '@core/person-segmentation/actions/StartBehindActorAnalysisAction';
import { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import { RunPersonSegmentationAction } from '@core/person-segmentation/actions/RunPersonSegmentationAction';
import { PersonSegmentationCacheHydrationAutomation } from '@core/person-segmentation/automations/PersonSegmentationCacheHydrationAutomation';
import { PersonSegmentationTriggerAutomation } from '@core/person-segmentation/automations/PersonSegmentationTriggerAutomation';
import { BehindActorTemplateAvailabilityAutomation } from '@core/person-segmentation/automations/BehindActorTemplateAvailabilityAutomation';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { FrameMotionCalculator } from '@core/person-segmentation/services/FrameMotionCalculator';
import { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import { LaplacianVarianceCalculator } from '@core/person-segmentation/services/LaplacianVarianceCalculator';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonBboxCalculator } from '@core/person-segmentation/services/PersonBboxCalculator';
import { PersonSegmentationRunController } from '@core/person-segmentation/services/PersonSegmentationRunController';
import { PoseFeatureExtractor } from '@core/person-segmentation/services/PoseFeatureExtractor';
import { SamplePassEvaluator } from '@core/person-segmentation/services/SamplePassEvaluator';
import { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { IncrementalPersonSegmentationAnalyzer } from '@core/person-segmentation/services/IncrementalPersonSegmentationAnalyzer';
import { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import { PersonSegmentationSession } from '@core/person-segmentation/services/PersonSegmentationSession';
import { ConsoleRunProfiler } from '@core/person-segmentation/services/ConsoleRunProfiler';
import { NoopRunProfiler } from '@core/person-segmentation/services/NoopRunProfiler';
import { PersonSegmentationCachePersister } from '@core/person-segmentation/services/PersonSegmentationCachePersister';
import { PrefetchingVideoFrameReader } from '@core/person-segmentation/services/PrefetchingVideoFrameReader';
import { VideoFramePixelBuffer } from '@core/person-segmentation/services/VideoFramePixelBuffer';
import { ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import { ShoulderDriftCalculator } from '@core/person-segmentation/services/ShoulderDriftCalculator';
import { VideoFrameBitmapCapturer } from '@core/person-segmentation/services/VideoFrameBitmapCapturer';
import { VideoFrameSeeker } from '@core/person-segmentation/services/VideoFrameSeeker';
import { BehindActorAnalysisGateStore } from '@core/person-segmentation/store/BehindActorAnalysisGateStore';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { PersonSegmentationFlowStore } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import { PersonSegmentationProgressStore } from '@core/person-segmentation/store/PersonSegmentationProgressStore';
import { SegmentMaskBackfillStore } from '@core/person-segmentation/store/SegmentMaskBackfillStore';
import { MediaPipePersonSegmenter } from '@core/person-segmentation/infrastructure/MediaPipePersonSegmenter';
import { PersonMaskCapturer } from '@core/person-segmentation/infrastructure/PersonMaskCapturer';
import { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';
import { PersonSegmenterModelUrls } from '@core/person-segmentation/infrastructure/PersonSegmenterModelUrls';
import type { PersonSegmenterModelLocations } from '@core/person-segmentation/infrastructure/PersonSegmenterModelLocations';
import { SceneValidityScanner } from '@core/person-segmentation/infrastructure/SceneValidityScanner';
import { IndexedDbPersonSegmentationCacheRepository } from '@core/person-segmentation/infrastructure/repositories/IndexedDbPersonSegmentationCacheRepository';
import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';
import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';

/**
 * How many projects keep their mask cache resident in IndexedDB
 * before the least recently opened one is evicted.
 *
 * Independent of the source-video cap, which it happens to equal:
 * masks are re-derivable, so keeping them for a project whose video
 * is gone costs a little space, and losing them early costs a re-scan
 * and nothing else.
 */
const MAX_CACHED_SEGMENTATION_PROJECTS = 3;

/**
 * Where a page served to a browser reads MediaPipe from. The GPU
 * delegate is the default because a real browser has WebGL2 and the
 * detector runs on a device the user is waiting at.
 */
const DEFAULT_MODEL_LOCATIONS: PersonSegmenterModelLocations = {
  wasmSimd: PersonSegmenterModelUrls.WASM_SIMD,
  wasmNoSimd: PersonSegmenterModelUrls.WASM_NO_SIMD,
  poseModelUrl: PersonSegmenterModelUrls.POSE_LANDMARKER,
  segmenterModelUrl: PersonSegmenterModelUrls.SELFIE_SEGMENTER,
  delegate: 'GPU',
};

export interface PersonSegmentationDependencies {
  readonly indexedDb: IndexedDbClient;
  readonly editorStore: EditorStore;
  readonly refresh: RefreshDocumentAction;
  readonly previewSupportChecker: BehindActorPreviewSupportChecker;
  /** The gallery's catalog, so opt-in templates can be re-offered when the preview changes. */
  readonly pickerTemplateRepository: TemplateRepository;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly telemetry: TelemetryModule;
  readonly appNoticeChannel: AppNoticeChannel;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly storageFootprintProbe: StorageFootprintProbe;
  /** Whether the detector should measure its own wall clock and print the breakdown. */
  readonly profilingEnabled: boolean;
  /** Overrides the public CDN, for a host that has to answer offline. */
  readonly modelLocations?: PersonSegmenterModelLocations;
}

export type PersonSegmentationModule = ReturnType<typeof bootPersonSegmentation>;

/**
 * Boots the person-segmentation feature: the worker-backed detector,
 * the per-project cache repository, the flow / progress stores, the
 * template-triggered automation, and the actions callers drive from
 * the editor UI. The MediaPipe worker is created here — one instance
 * per session.
 */
export function bootPersonSegmentation(deps: PersonSegmentationDependencies) {
  const worker = new Worker(
    new URL('../../core/person-segmentation/infrastructure/workers/personSegmenterWorker.ts', import.meta.url),
    { type: 'module' },
  );
  deps.workerErrorMonitor.monitor(worker, 'person-segmenter-worker');
  const workerClient = new PersonSegmenterWorkerClient(worker, deps.modelLocations ?? DEFAULT_MODEL_LOCATIONS);
  const runProfiler: RunProfiler = deps.profilingEnabled ? new ConsoleRunProfiler() : new NoopRunProfiler();
  const resultAssembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());
  const captionedRanges = new CaptionedRangeCollector();

  const frameReaderFor = (profilerScope: string): PrefetchingVideoFrameReader => new PrefetchingVideoFrameReader(
    new VideoFrameSeeker(),
    new VideoFrameBitmapCapturer(),
    runProfiler,
    profilerScope,
  );

  const sceneScanner = new SceneValidityScanner(
    frameReaderFor('scan'),
    new VideoFramePixelBuffer(),
    new LaplacianVarianceCalculator(),
    new FrameMotionCalculator(),
    new PoseFeatureExtractor(),
    new PersonBboxCalculator(),
    new ShoulderDriftCalculator(),
    new SamplePassEvaluator(),
    workerClient,
    runProfiler,
  );
  const maskCapturer = new PersonMaskCapturer(
    frameReaderFor('masks'),
    workerClient,
    runProfiler,
  );
  const segmenter = new MediaPipePersonSegmenter(workerClient, sceneScanner, maskCapturer, resultAssembler, runProfiler);

  const gatingService = new BehindActorGatingService();
  const runController = new PersonSegmentationRunController();
  const progressStore = new PersonSegmentationProgressStore();
  const flowStore = new PersonSegmentationFlowStore();
  const loadedCacheStore = new LoadedPersonSegmentationCacheStore();
  const analysisGateStore = new BehindActorAnalysisGateStore();
  const cacheRepository = new IndexedDbPersonSegmentationCacheRepository(deps.indexedDb, resultAssembler, MAX_CACHED_SEGMENTATION_PROJECTS);

  const segmentMaskBackfillStore = new SegmentMaskBackfillStore();
  const scanSourceResolver = new ScanVideoSourceResolver();
  const resultReader = new PersonSegmentationResultReader(cacheRepository, loadedCacheStore);
  const cachePersister = new PersonSegmentationCachePersister(cacheRepository, loadedCacheStore);
  const runAction = new RunPersonSegmentationAction(segmenter, runController, progressStore);
  const analyzeRangesAction = new AnalyzeVideoRangesAction(
    deps.editorStore,
    runAction,
    resultReader,
    resultAssembler,
    loadedCacheStore,
    cachePersister,
  );
  const incrementalAnalyzer = new IncrementalPersonSegmentationAnalyzer(
    deps.editorStore,
    new PersonSegmentationSession(deps.editorStore, scanSourceResolver, new HiddenVideoLoader()),
    analyzeRangesAction,
    resultReader,
    scanSourceResolver,
    cachePersister,
  );
  const startAnalysisAction = new StartBehindActorAnalysisAction(
    deps.editorStore,
    captionedRanges,
    incrementalAnalyzer,
  );
  const ensureSegmentMasksAction = new EnsureSegmentMasksCachedAction(
    deps.editorStore,
    scanSourceResolver,
    new HiddenVideoLoader(),
    workerClient,
    maskCapturer,
    cachePersister,
    resultReader,
    resultAssembler,
    loadedCacheStore,
    segmentMaskBackfillStore,
  );

  const contributionBuilder = new BehindActorContributionBuilder(gatingService);
  const measurementReporter = new NonBlockingFailureReporter(
    deps.telemetry.telemetry,
    deps.appNoticeChannel,
    deps.errorClassifier,
    deps.errorTelemetryDescriber,
    deps.storageFootprintProbe,
    'behind_actor_measurement_failed',
  );
  const exportContributor = new BehindActorExportContributor(
    contributionBuilder,
    resultReader,
    captionedRanges,
    incrementalAnalyzer,
    ensureSegmentMasksAction,
    measurementReporter,
  );


  const triggerAutomation = new PersonSegmentationTriggerAutomation(
    deps.editorStore,
    captionedRanges,
    resultReader,
    startAnalysisAction,
    flowStore,
    deps.refresh,
    deps.previewSupportChecker,
  );
  const templateAvailabilityAutomation = new BehindActorTemplateAvailabilityAutomation(
    deps.editorStore,
    deps.pickerTemplateRepository,
    deps.previewSupportChecker,
  );
  const cacheHydrationAutomation = new PersonSegmentationCacheHydrationAutomation(
    deps.editorStore,
    cacheRepository,
    loadedCacheStore,
  );

  return {
    progressStore,
    flowStore,
    runController,
    cacheRepository,
    loadedCacheStore,
    analysisGateStore,
    segmentMaskBackfillStore,
    gatingService,
    incrementalAnalyzer,
    captionedRanges,
    resultAssembler,
    contributionBuilder,
    exportContributor,
    previewSupportChecker: deps.previewSupportChecker,
    triggerAutomation,
    cacheHydrationAutomation,
    templateAvailabilityAutomation,
    actions: {
      run: runAction,
      startAnalysis: startAnalysisAction,
      ensureSegmentMasks: ensureSegmentMasksAction,
      cancel: new CancelPersonSegmentationAction(runController),
    },
  };
}

/**
 * Returns the schemas of the person-segmentation cache stores on the
 * shared IndexedDB connection: the results, and the access times
 * their eviction order is kept in. No per-version migrations.
 */
export function buildPersonSegmentationCacheIndexedDbStoreDefinitions(): IndexedDbStoreDefinition[] {
  return [
    { name: 'person-segmentation-cache', keyPath: 'projectId' },
    { name: 'person-segmentation-cache-access', keyPath: 'projectId' },
  ];
}
