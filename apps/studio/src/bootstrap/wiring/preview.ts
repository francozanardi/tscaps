import type { MediaBunnyTranscodeCoordinator } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type {
  PreviewSurfaceVariant,
  SwitchableVideoPreviewSurface,
  VideoPreviewSurface,
} from '@core/preview/domain/VideoPreviewSurface';
import type { PreviewSurfaceVariantPreference } from '@core/preview/domain/PreviewSurfaceVariantPreference';
import { LazySwitchableVideoPreviewSurface } from '@core/preview/infrastructure/LazySwitchableVideoPreviewSurface';
import { PreviewProxyGenerationPolicy } from '@core/preview/services/PreviewProxyGenerationPolicy';
import { PreviewProxyGenerationBudget } from '@core/preview/services/PreviewProxyGenerationBudget';
import { MediaBunnyVideoMetadataProbe } from '@core/videos/infrastructure/MediaBunnyVideoMetadataProbe';
import { CanvasVideoPreviewSurface } from '@core/preview/infrastructure/CanvasVideoPreviewSurface';
import { NativeVideoPreviewSurface } from '@core/preview/infrastructure/NativeVideoPreviewSurface';
import { DocumentHiddenPlaybackPauser } from '@core/preview/infrastructure/DocumentHiddenPlaybackPauser';
import { MediaBunnyPreviewSourceLoader } from '@core/preview/infrastructure/mediabunny/MediaBunnyPreviewSourceLoader';
import { MediaBunnyPreviewProxyGenerator } from '@core/preview/infrastructure/mediabunny/MediaBunnyPreviewProxyGenerator';
import { FixedPreviewProxyCodecPolicy } from '@core/preview/infrastructure/mediabunny/FixedPreviewProxyCodecPolicy';
import { DefaultPreviewProxyOutputStrategyFactory } from '@core/preview/infrastructure/DefaultPreviewProxyOutputStrategyFactory';
import { IndexedDbPreviewProxyRepository } from '@core/preview/infrastructure/repositories/IndexedDbPreviewProxyRepository';
import { MAX_CACHED_PROJECT_VIDEOS } from '@bootstrap/wiring/videos';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import { PreviewProxyDownloadStore } from '@core/preview/store/PreviewProxyDownloadStore';
import { PreviewProxyGenerationStore } from '@core/preview/store/PreviewProxyGenerationStore';
import { GeneratePreviewProxyAction } from '@core/preview/actions/GeneratePreviewProxyAction';
import { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';
import { EditorStorePreviewCutsSource } from '@bootstrap/wiring/EditorStorePreviewCutsSource';
import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';

const PREVIEW_MAX_LONGEST_SIDE_PX = 1280;

export interface PreviewSurfaceDependencies {
  readonly store: EditorStore;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly previewSurfacePreference: PreviewSurfaceVariantPreference;
}

export interface PreviewDependencies {
  readonly store: EditorStore;
  readonly indexedDb: IndexedDbClient;
  readonly blobReadabilityProbe: BlobReadabilityProbe;
  readonly previewProxyEnabled: boolean;
  readonly isMobileDevice: boolean;
  readonly previewSurface: SwitchableVideoPreviewSurface;
  readonly transcodeCoordinator: MediaBunnyTranscodeCoordinator;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly telemetry: TelemetryModule;
  readonly appNoticeChannel: AppNoticeChannel;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly storageFootprintProbe: StorageFootprintProbe;
}

export interface PreviewModule {
  readonly surface: SwitchableVideoPreviewSurface;
  readonly proxyRepository: PreviewProxyRepository;
  readonly proxyResolver: PreviewProxyResolver;
  readonly proxyGenerationStore: PreviewProxyGenerationStore;
  /** Progress of the proxy fetch an opening project is held on. */
  readonly proxyDownloadStore: PreviewProxyDownloadStore;
  readonly actions: { readonly generateProxy: GeneratePreviewProxyAction };
  /**
   * Whether the proxy pipeline is live for this session. When
   * `false`, the surface plays the source blob verbatim and no
   * proxy is generated, cached, or consulted. Consumers rendering
   * "low-res preview" affordances gate on this flag.
   */
  readonly proxyPipelineEnabled: boolean;
}

/**
 * Boots the proxy pipeline around an already-built preview surface:
 * the repository stack, the generation policy and resolver, and the
 * on-demand generation action with its progress store. The surface
 * itself comes from {@link bootPreviewSurface}, which runs earlier
 * in the composition because other modules consume it before the
 * pipeline exists.
 */
export function bootPreview(deps: PreviewDependencies): PreviewModule {
  const localProxyRepository = new IndexedDbPreviewProxyRepository(deps.indexedDb, deps.blobReadabilityProbe, MAX_CACHED_PROJECT_VIDEOS);
  const proxyRepository: PreviewProxyRepository = localProxyRepository;

  const proxyGenerator = new MediaBunnyPreviewProxyGenerator(
    new DefaultPreviewProxyOutputStrategyFactory(deps.workerErrorMonitor),
    deps.transcodeCoordinator,
    new FixedPreviewProxyCodecPolicy(),
  );
  const proxyFallbackReporter = new NonBlockingFailureReporter(
    deps.telemetry.telemetry,
    deps.appNoticeChannel,
    deps.errorClassifier,
    deps.errorTelemetryDescriber,
    deps.storageFootprintProbe,
    'preview_proxy_fallback',
  );
  const proxyResolver = new PreviewProxyResolver(
    proxyRepository,
    proxyGenerator,
    new MediaBunnyVideoMetadataProbe(),
    new PreviewProxyGenerationPolicy(deps.isMobileDevice),
    new PreviewProxyGenerationBudget(),
    proxyFallbackReporter,
    deps.previewProxyEnabled,
  );
  const proxyGenerationStore = new PreviewProxyGenerationStore();
  const proxyDownloadStore = new PreviewProxyDownloadStore();
  const generateProxy = new GeneratePreviewProxyAction(
    deps.store,
    proxyResolver,
    proxyRepository,
    proxyGenerationStore,
    deps.telemetry.telemetry,
    deps.errorClassifier,
    deps.errorTelemetryDescriber,
  );
  return {
    surface: deps.previewSurface,
    proxyRepository,
    proxyResolver,
    proxyGenerationStore,
    proxyDownloadStore,
    actions: { generateProxy },
    proxyPipelineEnabled: deps.previewProxyEnabled,
  };
}

/**
 * Builds the switchable preview surface the editor plays on. Kept
 * apart from {@link bootPreview} because the surface has consumers
 * that wire up before the proxy pipeline does (support checkers that
 * read the live variant). Each variant is built on first use; a
 * forced preference pins the surface to that variant for the whole
 * session. Also installs the hidden-tab playback pauser.
 */
export function bootPreviewSurface(deps: PreviewSurfaceDependencies): SwitchableVideoPreviewSurface {
  const cutsSource = new EditorStorePreviewCutsSource(deps.store);
  const factories: Record<PreviewSurfaceVariant, () => VideoPreviewSurface> = {
    canvas: () => buildCanvasSurface(cutsSource, deps.workerErrorMonitor),
    native: () => new NativeVideoPreviewSurface(cutsSource),
  };
  const locked = deps.previewSurfacePreference !== 'auto';
  const initialVariant = deps.previewSurfacePreference === 'auto' ? 'canvas' : deps.previewSurfacePreference;
  const surface = new LazySwitchableVideoPreviewSurface(factories, initialVariant, locked);
  new DocumentHiddenPlaybackPauser(surface).install();
  return surface;
}

function buildCanvasSurface(
  cutsSource: EditorStorePreviewCutsSource,
  workerErrorMonitor: WorkerErrorMonitor,
): VideoPreviewSurface {
  const resolutionCap = new PreviewResolutionCap(PREVIEW_MAX_LONGEST_SIDE_PX);
  const loader = new MediaBunnyPreviewSourceLoader(resolutionCap, workerErrorMonitor);
  return new CanvasVideoPreviewSurface(loader, cutsSource, resolutionCap);
}

/**
 * Returns the schemas of the proxy stores on the shared IndexedDB
 * connection: the proxies, and the access times their eviction order
 * is kept in, apart from the bytes for the same reason the videos
 * stores keep theirs apart. No per-version migrations.
 */
export function buildVideoProxiesIndexedDbStoreDefinitions(): IndexedDbStoreDefinition[] {
  return [
    { name: 'video-proxies', keyPath: 'projectId' },
    { name: 'video-proxies-access', keyPath: 'projectId' },
  ];
}
