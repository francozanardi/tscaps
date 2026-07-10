import type { MediaBunnyTranscodeCoordinator } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { PreviewSurfaceVariant, VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import { CanvasVideoPreviewSurface } from '@core/preview/infrastructure/CanvasVideoPreviewSurface';
import { NativeVideoPreviewSurface } from '@core/preview/infrastructure/NativeVideoPreviewSurface';
import { DocumentHiddenPlaybackPauser } from '@core/preview/infrastructure/DocumentHiddenPlaybackPauser';
import { MediaBunnyPreviewSourceLoader } from '@core/preview/infrastructure/mediabunny/MediaBunnyPreviewSourceLoader';
import { MediaBunnyPreviewProxyGenerator } from '@core/preview/infrastructure/mediabunny/MediaBunnyPreviewProxyGenerator';
import { FixedPreviewProxyCodecPolicy } from '@core/preview/infrastructure/mediabunny/FixedPreviewProxyCodecPolicy';
import { DefaultPreviewProxyOutputStrategyFactory } from '@core/preview/infrastructure/DefaultPreviewProxyOutputStrategyFactory';
import { IndexedDbPreviewProxyRepository } from '@core/preview/infrastructure/repositories/IndexedDbPreviewProxyRepository';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';
import { EditorStorePreviewCutsSource } from '@bootstrap/wiring/EditorStorePreviewCutsSource';

const PREVIEW_MAX_LONGEST_SIDE_PX = 1280;

export interface PreviewDependencies {
  readonly store: EditorStore;
  readonly indexedDb: IndexedDbClient;
  readonly previewProxyEnabled: boolean;
  readonly previewSurfaceVariant: PreviewSurfaceVariant;
  readonly transcodeCoordinator: MediaBunnyTranscodeCoordinator;
}

export interface PreviewModule {
  readonly surface: VideoPreviewSurface;
  readonly proxyRepository: PreviewProxyRepository;
  readonly proxyResolver: PreviewProxyResolver;
  /**
   * Whether the proxy pipeline is live for this session. When
   * `false`, the surface plays the source blob verbatim and no
   * proxy is generated, cached, or consulted. Consumers rendering
   * "low-res preview" affordances gate on this flag.
   */
  readonly proxyPipelineEnabled: boolean;
  /**
   * The concrete surface variant driving playback. Consumers that
   * need to know whether a canvas-shaped overlay path is available
   * (e.g. an effect that samples the source frame) read this flag —
   * canvas variants expose a canvas element, the native variant does
   * not.
   */
  readonly surfaceVariant: PreviewSurfaceVariant;
}

/**
 * Boots the preview feature: the video preview surface that drives
 * editor playback, plus the proxy pipeline that produces the
 * normalized 480p H.264 file the canvas surface loads. The returned
 * surface is created with no host container bound — `start(container)`
 * runs when the editor host mounts.
 *
 * The concrete surface is picked from `previewSurfaceVariant`. On the
 * `native` variant the proxy repository and resolver are still wired
 * (so the module shape stays uniform for consumers) but the resolver
 * is constructed in its disabled mode, so no proxy is ever generated
 * or persisted while the native surface owns playback.
 */
export function bootPreview(deps: PreviewDependencies): PreviewModule {
  const localProxyRepository = new IndexedDbPreviewProxyRepository(deps.indexedDb);
  const proxyRepository: PreviewProxyRepository = localProxyRepository;

  const cutsSource = new EditorStorePreviewCutsSource(deps.store);
  const surface = buildVideoPreviewSurface(deps.previewSurfaceVariant, cutsSource);
  const hiddenTabPauser = new DocumentHiddenPlaybackPauser(surface);
  hiddenTabPauser.install();
  const proxyGenerator = new MediaBunnyPreviewProxyGenerator(
    new DefaultPreviewProxyOutputStrategyFactory(),
    deps.transcodeCoordinator,
    new FixedPreviewProxyCodecPolicy(),
  );
  const proxyResolver = new PreviewProxyResolver(proxyRepository, proxyGenerator, deps.previewProxyEnabled);
  return {
    surface,
    proxyRepository,
    proxyResolver,
    proxyPipelineEnabled: deps.previewProxyEnabled,
    surfaceVariant: deps.previewSurfaceVariant,
  };
}

function buildVideoPreviewSurface(
  variant: PreviewSurfaceVariant,
  cutsSource: EditorStorePreviewCutsSource,
): VideoPreviewSurface {
  if (variant === 'native') {
    return new NativeVideoPreviewSurface(cutsSource);
  }
  const resolutionCap = new PreviewResolutionCap(PREVIEW_MAX_LONGEST_SIDE_PX);
  const loader = new MediaBunnyPreviewSourceLoader(resolutionCap);
  return new CanvasVideoPreviewSurface(loader, cutsSource, resolutionCap);
}

/**
 * Returns the proxy store schema for the shared IndexedDB
 * connection. No per-version migrations today — the record shape has
 * been stable since introduction.
 */
export function buildVideoProxiesIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return { name: 'video-proxies', keyPath: 'projectId' };
}
