import { BidiJsCharacterClassifier, StrongCharacterMajorityTextDirectionDetector } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { TranscriptionAudioLengthPolicy } from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import { ApplyTextDirectionAction } from '@core/preprocessing/actions/ApplyTextDirectionAction';
import { PreprocessingFlowStore } from '@core/preprocessing/store/PreprocessingFlowStore';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import { VideoValidator } from '@core/preprocessing/services/VideoValidator';
import { PreprocessPersistence } from '@core/preprocessing/services/PreprocessPersistence';
import { PreprocessingTelemetryReporter } from '@core/preprocessing/services/PreprocessingTelemetryReporter';
import { PreviewProxyStage } from '@core/preprocessing/services/PreviewProxyStage';
import type { ProxyTiming } from '@core/preprocessing/domain/ProxyTiming';
import { MediaBunnyVideoMetadataProbe } from '@core/videos/infrastructure/MediaBunnyVideoMetadataProbe';
import type { VideoExportSupport } from '@core/export/domain/VideoExportSupport';
import { MediaBunnyVideoExportSupport } from '@core/export/infrastructure/MediaBunnyVideoExportSupport';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import type { PreviewModule } from '@bootstrap/wiring/preview';
import type { ProjectsModule } from '@bootstrap/wiring/projects';
import type { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { VideosModule } from '@bootstrap/wiring/videos';
import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { LocalStorageLanguageUsageRepository } from '@core/preprocessing/infrastructure/repositories/LocalStorageLanguageUsageRepository';
import { BrowserLocaleInspector } from '@core/preprocessing/services/BrowserLocaleInspector';
import { LanguageCanonicalCodeResolver } from '@core/preprocessing/services/LanguageCanonicalCodeResolver';
import { LanguageRanker } from '@core/preprocessing/services/LanguageRanker';

export interface PreprocessingDependencies {
  readonly store: EditorStore;
  readonly progressStore: PreprocessingProgressStore;
  readonly transcribe: TranscribeAction;
  readonly audioLengthPolicy: TranscriptionAudioLengthPolicy;
  readonly runTaggers: RunTaggersAction;
  readonly refresh: RefreshDocumentAction;
  readonly deriver: DocumentDeriver;
  readonly preview: PreviewModule;
  readonly videos: VideosModule;
  readonly projects: ProjectsModule;
  readonly telemetry: TelemetryModule;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly storagePersistence: StoragePersistence;
  readonly localStorageClient: LocalStorageClient;
  readonly previewProxyEnabled: boolean;
  /** When false, the pipeline runs without touching the project repository. */
  readonly projectPersistenceEnabled: boolean;
}

export type PreprocessingModule = ReturnType<typeof bootPreprocessing>;

/**
 * Boots the editor's preprocessing pipeline entry point — the single
 * action the start-video dialog invokes — plus the derived flow store
 * that tells the UI when to open that dialog. Wires the action
 * against the transcribe action, the tagger runner, the refresh
 * action, and the project persistence actions so each step lands on
 * a coherent editor-store state. Starts the flow store before
 * returning so its subscriptions are live.
 */
export function bootPreprocessing(deps: PreprocessingDependencies) {
  const flow = new PreprocessingFlowStore(deps.store);
  flow.start();

  const videoValidator = new VideoValidator(deps.store, deps.audioLengthPolicy);
  videoValidator.start();

  const languageCanonicalCodeResolver = new LanguageCanonicalCodeResolver();
  const languageUsageRepository = new LocalStorageLanguageUsageRepository(
    deps.localStorageClient,
    languageCanonicalCodeResolver,
  );
  const languageRanker = new LanguageRanker(
    languageUsageRepository,
    new BrowserLocaleInspector(),
    languageCanonicalCodeResolver,
  );


  const applyTextDirection = new ApplyTextDirectionAction(
    deps.store,
    new StrongCharacterMajorityTextDirectionDetector(new BidiJsCharacterClassifier()),
  );
  const applyMultipleSpeakers = new ApplyMultipleSpeakersAction(
    deps.store,
    deps.deriver,
    new SheetColorPalette(),
    new SpeakerSheetMatcher(),
  );

  const canPersist = () => deps.projectPersistenceEnabled;
  const surfaceLabel = 'web';
  const transcribesOnDevice = true;
  const proxyTiming: ProxyTiming = 'sequential-after-transcribe';
  const videoIsUploaded = false;
  const exportSupport: VideoExportSupport = new MediaBunnyVideoExportSupport();

  const previewProxyStage = new PreviewProxyStage(
    deps.store,
    deps.preview.proxyResolver,
    deps.preview.proxyRepository,
    deps.progressStore,
    proxyTiming,
    deps.previewProxyEnabled,
  );
  const persistence = new PreprocessPersistence(
    deps.store,
    deps.projects.actions.create,
    deps.projects.actions.save,
    deps.videos.keeper,
    canPersist,
    deps.projects.saveFailureReporter,
    deps.projects.videoStoreFailureReporter,
    videoIsUploaded,
  );
  const telemetryReporter = new PreprocessingTelemetryReporter(
    deps.store,
    deps.telemetry.telemetry,
    deps.errorTelemetryDescriber,
    surfaceLabel,
    transcribesOnDevice,
  );

  return {
    flow,
    progressStore: deps.progressStore,
    audioLengthPolicy: deps.audioLengthPolicy,
    videoValidator,
    languageRanker,
    languageUsageRepository,
    actions: {
      preprocessVideo: new PreprocessVideoAction(
        deps.store,
        deps.transcribe,
        deps.runTaggers,
        applyMultipleSpeakers,
        applyTextDirection,
        deps.refresh,
        previewProxyStage,
        persistence,
        deps.videos.services.compatibilityChecker,
        exportSupport,
        deps.audioLengthPolicy,
        deps.progressStore,
        telemetryReporter,
        new MediaBunnyVideoMetadataProbe(),
        deps.errorClassifier,
        deps.storagePersistence,
        languageCanonicalCodeResolver,
      ),
    },
  };
}

/**
 * Builds the cross-phase progress store consumed by both the
 * transcription module (raises its phases) and the preprocessing
 * module (raises the proxy phase and the final complete). Created
 * up here in the composition root so it can be passed down before
 * either module boots.
 */
export function buildPreprocessingProgressStore(): PreprocessingProgressStore {
  return new PreprocessingProgressStore();
}
