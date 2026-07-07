import type { MediaBunnyTranscodeCoordinator } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import { CanvasVideoPreviewSurface } from '@core/preview/infrastructure/CanvasVideoPreviewSurface';
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
  readonly transcodeCoordinator: MediaBunnyTranscodeCoordinator;
}

export interface PreviewModule {
  readonly surface: VideoPreviewSurface;
  readonly proxyRepository: PreviewProxyRepository;
  readonly proxyResolver: PreviewProxyResolver;
}

/**
 * Boots the preview feature: the video preview surface that drives
 * editor playback, plus the proxy pipeline that produces the
 * normalized 480p H.264 file the surface actually loads. The returned
 * surface is created with no canvas bound — `start(canvas)` runs when
 * the editor host mounts.
 */
export function bootPreview(deps: PreviewDependencies): PreviewModule {
  const localProxyRepository = new IndexedDbPreviewProxyRepository(deps.indexedDb);
  const proxyRepository: PreviewProxyRepository = localProxyRepository;

  const resolutionCap = new PreviewResolutionCap(PREVIEW_MAX_LONGEST_SIDE_PX);
  const loader = new MediaBunnyPreviewSourceLoader(resolutionCap);
  const cutsSource = new EditorStorePreviewCutsSource(deps.store);
  const surface = new CanvasVideoPreviewSurface(loader, cutsSource, resolutionCap);
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
  };
}

/**
 * Returns the proxy store schema for the shared IndexedDB
 * connection. No per-version migrations today — the record shape has
 * been stable since introduction.
 */
export function buildVideoProxiesIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return { name: 'video-proxies', keyPath: 'projectId' };
}
