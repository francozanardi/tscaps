import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import { CancelPersonSegmentationAction } from '@core/person-segmentation/actions/CancelPersonSegmentationAction';
import { EnsurePersonSegmentationCachedAction } from '@core/person-segmentation/actions/EnsurePersonSegmentationCachedAction';
import { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import { RunPersonSegmentationAction } from '@core/person-segmentation/actions/RunPersonSegmentationAction';
import { PersonSegmentationCacheHydrationAutomation } from '@core/person-segmentation/automations/PersonSegmentationCacheHydrationAutomation';
import { PersonSegmentationTriggerAutomation } from '@core/person-segmentation/automations/PersonSegmentationTriggerAutomation';
import { FrameMotionCalculator } from '@core/person-segmentation/services/FrameMotionCalculator';
import { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import { LaplacianVarianceCalculator } from '@core/person-segmentation/services/LaplacianVarianceCalculator';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonBboxCalculator } from '@core/person-segmentation/services/PersonBboxCalculator';
import { PersonSegmentationRunController } from '@core/person-segmentation/services/PersonSegmentationRunController';
import { PoseFeatureExtractor } from '@core/person-segmentation/services/PoseFeatureExtractor';
import { SamplePassEvaluator } from '@core/person-segmentation/services/SamplePassEvaluator';
import { ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import { ShoulderDriftCalculator } from '@core/person-segmentation/services/ShoulderDriftCalculator';
import { VideoFrameBitmapCapturer } from '@core/person-segmentation/services/VideoFrameBitmapCapturer';
import { VideoFrameSeeker } from '@core/person-segmentation/services/VideoFrameSeeker';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { PersonSegmentationFlowStore } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import { PersonSegmentationProgressStore } from '@core/person-segmentation/store/PersonSegmentationProgressStore';
import { SegmentMaskBackfillStore } from '@core/person-segmentation/store/SegmentMaskBackfillStore';
import { MediaPipePersonSegmenter } from '@core/person-segmentation/infrastructure/MediaPipePersonSegmenter';
import { PersonMaskCapturer } from '@core/person-segmentation/infrastructure/PersonMaskCapturer';
import { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';
import { SceneValidityScanner } from '@core/person-segmentation/infrastructure/SceneValidityScanner';
import { IndexedDbPersonSegmentationCacheRepository } from '@core/person-segmentation/infrastructure/repositories/IndexedDbPersonSegmentationCacheRepository';
import { MAX_CACHED_PROJECT_ARTIFACTS } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';

export interface PersonSegmentationDependencies {
  readonly indexedDb: IndexedDbClient;
  readonly editorStore: EditorStore;
  readonly previewSupportChecker: BehindActorPreviewSupportChecker;
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
  const workerClient = new PersonSegmenterWorkerClient(worker);

  const sceneScanner = new SceneValidityScanner(
    new VideoFrameSeeker(),
    new VideoFrameBitmapCapturer(),
    new LaplacianVarianceCalculator(),
    new FrameMotionCalculator(),
    new PoseFeatureExtractor(),
    new PersonBboxCalculator(),
    new ShoulderDriftCalculator(),
    new SamplePassEvaluator(),
    new PassingWindowFinder(),
    workerClient,
  );
  const maskCapturer = new PersonMaskCapturer(
    new VideoFrameSeeker(),
    new VideoFrameBitmapCapturer(),
    workerClient,
  );
  const segmenter = new MediaPipePersonSegmenter(workerClient, sceneScanner, maskCapturer);

  const gatingService = new BehindActorGatingService();
  const runController = new PersonSegmentationRunController();
  const progressStore = new PersonSegmentationProgressStore();
  const flowStore = new PersonSegmentationFlowStore();
  const loadedCacheStore = new LoadedPersonSegmentationCacheStore();
  const cacheRepository = new IndexedDbPersonSegmentationCacheRepository(deps.indexedDb, MAX_CACHED_PROJECT_ARTIFACTS);

  const segmentMaskBackfillStore = new SegmentMaskBackfillStore();
  const scanSourceResolver = new ScanVideoSourceResolver();
  const runAction = new RunPersonSegmentationAction(segmenter, runController, progressStore);
  const ensureCachedAction = new EnsurePersonSegmentationCachedAction(
    deps.editorStore,
    scanSourceResolver,
    new HiddenVideoLoader(),
    runAction,
    cacheRepository,
    loadedCacheStore,
  );
  const ensureSegmentMasksAction = new EnsureSegmentMasksCachedAction(
    deps.editorStore,
    scanSourceResolver,
    new HiddenVideoLoader(),
    workerClient,
    maskCapturer,
    cacheRepository,
    loadedCacheStore,
    segmentMaskBackfillStore,
  );

  const triggerAutomation = new PersonSegmentationTriggerAutomation(
    deps.editorStore,
    cacheRepository,
    flowStore,
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
    segmentMaskBackfillStore,
    gatingService,
    previewSupportChecker: deps.previewSupportChecker,
    triggerAutomation,
    cacheHydrationAutomation,
    actions: {
      run: runAction,
      ensureCached: ensureCachedAction,
      ensureSegmentMasks: ensureSegmentMasksAction,
      cancel: new CancelPersonSegmentationAction(runController),
    },
  };
}

/**
 * Returns the person-segmentation cache store schema for the shared
 * IndexedDB connection. No per-version migrations today — the store
 * is being introduced.
 */
export function buildPersonSegmentationCacheIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return { name: 'person-segmentation-cache', keyPath: 'projectId' };
}
