import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { MediaLibraryTelemetryReporter } from '@core/media/services/MediaLibraryTelemetryReporter';
import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { ProjectDependentStores } from '@core/_shared/infrastructure/ProjectDependentStores';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ImportMediaAssetAction } from '@core/media/actions/ImportMediaAssetAction';
import { MediaImportTelemetryReporter } from '@core/media/services/MediaImportTelemetryReporter';
import { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { LoadMediaAssetsAction } from '@core/media/actions/LoadMediaAssetsAction';
import { MoveMediaAssetAction } from '@core/media/actions/MoveMediaAssetAction';
import { RemoveMediaAssetAction } from '@core/media/actions/RemoveMediaAssetAction';
import { MediaAssetScopeFollower } from '@core/media/automations/MediaAssetScopeFollower';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetListChanges } from '@core/media/domain/MediaAssetListChanges';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import type { MediaLibraryAccess } from '@core/media/domain/MediaLibraryAccess';
import { AnimatedImageOpenerGifPlaybackProbe } from '@core/media/infrastructure/AnimatedImageOpenerGifPlaybackProbe';
import { FallbackAudioPlaybackProbe } from '@core/media/infrastructure/FallbackAudioPlaybackProbe';
import { MediaBunnyAudioPlaybackProbe } from '@core/media/infrastructure/MediaBunnyAudioPlaybackProbe';
import { WebAudioAudioPlaybackProbe } from '@core/media/infrastructure/WebAudioAudioPlaybackProbe';
import { buildGifOpener } from '@bootstrap/wiring/gifs';
import { BrowserImageDimensionsProbe } from '@core/media/infrastructure/BrowserImageDimensionsProbe';
import { LOCAL_MEDIA_ASSET_REALM, type MediaAssetRealm } from '@core/media/domain/MediaAssetRealm';
import { DeviceOnlyMediaAssetListChanges } from '@core/media/infrastructure/DeviceOnlyMediaAssetListChanges';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { FixedMediaAssetRealm } from '@core/media/infrastructure/FixedMediaAssetRealm';
import { OpenMediaLibraryAccess } from '@core/media/infrastructure/OpenMediaLibraryAccess';
import {
  IndexedDbMediaAssetBytesRepository,
  MEDIA_ASSET_BYTES_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetBytesRepository';
import {
  IndexedDbMediaAssetRepository,
  MEDIA_ASSETS_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetRepository';
import { SessionHeldMediaAssetBytesRepository } from '@core/media/infrastructure/repositories/SessionHeldMediaAssetBytesRepository';
import { MediaAssetOriginalsPrefetcher } from '@core/media/services/MediaAssetOriginalsPrefetcher';
import { MediaAssetOwnerResolver } from '@core/media/services/MediaAssetOwnerResolver';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetProxyCache } from '@core/media/services/MediaAssetProxyCache';
import { MediaAssetTypeDetector } from '@core/media/services/MediaAssetTypeDetector';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';
import { MediaBunnyVideoMetadataProbe } from '@core/videos/infrastructure/MediaBunnyVideoMetadataProbe';

export interface MediaDependencies {
  readonly store: EditorStore;
  readonly indexedDb: IndexedDbClient;
  readonly blobReadabilityProbe: BlobReadabilityProbe;
  readonly projectDependents: ProjectDependentStores;
  readonly proxyGenerator: PreviewProxyGenerator;
  readonly waveformExtractor: WaveformExtractor;
  readonly telemetry: Telemetry;
  /** How full this origin's storage is, read when a file could not be added. */
  readonly storageFootprintProbe: StorageFootprintProbe;
}

export type MediaModule = ReturnType<typeof bootMedia>;

/**
 * Boots media assets: the files a user adds besides a project's video —
 * footage, pictures, GIFs, audio — owned by a project or by their library.
 *
 * `assets` is the observable list the open project can use; `repository`
 * is where that list lives and `bytes` where each asset's bytes are
 * kept, both answering from this device alone or reaching a remote copy
 * as well, where there is one. `uploader` keeps that remote copy in step.
 * `preparer` makes each asset ready to preview and says when it is —
 * or that a GIF or an audio file cannot play in this browser, which
 * `gifPlayback` and the audio probes tell;
 * `proxyCache` holds what the open project's assets are previewed
 * through. `scopeFollower` keeps the list in step with the open project.
 * `waveforms` reads the envelope an audio file's poster is drawn from.
 */
export function bootMedia(deps: MediaDependencies) {
  const assets = new MediaAssetStore();
  const realm: MediaAssetRealm = new FixedMediaAssetRealm(LOCAL_MEDIA_ASSET_REALM);
  const deviceAssets = new IndexedDbMediaAssetRepository(deps.indexedDb, realm);
  const durableBytes = new IndexedDbMediaAssetBytesRepository(deps.indexedDb, deps.blobReadabilityProbe, deviceAssets);
  deps.projectDependents.add(deviceAssets);
  deps.projectDependents.add(durableBytes);
  const localBytes = new SessionHeldMediaAssetBytesRepository(durableBytes);
  const repository: MediaAssetRepository = deviceAssets;
  const bytes: MediaAssetBytesRepository = localBytes;
  const uploader: MediaAssetUploader = new DeviceOnlyMediaAssetUploader();
  const libraryAccess: MediaLibraryAccess = new OpenMediaLibraryAccess();
  const listChanges: MediaAssetListChanges = new DeviceOnlyMediaAssetListChanges();
  const owners = new MediaAssetOwnerResolver(libraryAccess);
  const gifPlayback = new AnimatedImageOpenerGifPlaybackProbe(buildGifOpener());
  // The order sound is decoded in to be heard: WebCodecs first, then Web Audio, which Safari reads FLAC through.
  const audioPlayback = new FallbackAudioPlaybackProbe(new MediaBunnyAudioPlaybackProbe(), new WebAudioAudioPlaybackProbe());
  const preparer = new MediaAssetPreparer(bytes, deps.proxyGenerator, uploader, gifPlayback, audioPlayback);
  const load = new LoadMediaAssetsAction(repository, assets, preparer, new MediaAssetOriginalsPrefetcher(bytes), uploader);
  const libraryTelemetry = new MediaLibraryTelemetryReporter(deps.telemetry);
  const move = new MoveMediaAssetAction(deps.store, assets, repository, bytes, owners, uploader, libraryTelemetry);
  const errorNames = new ErrorNameTelemetryDescriber();
  return {
    assets,
    bytes,
    uploader,
    preparer,
    gifPlayback,
    audioPlayback,
    proxyCache: new MediaAssetProxyCache(bytes, assets),
    waveforms: deps.waveformExtractor,
    scopeFollower: new MediaAssetScopeFollower(deps.store, assets, load, move, listChanges),
    actions: {
      import: new ImportMediaAssetAction(
        deps.store,
        assets,
        repository,
        bytes,
        new MediaAssetTypeDetector(),
        new MediaBunnyVideoMetadataProbe(),
        new BrowserImageDimensionsProbe(),
        owners,
        uploader,
        preparer,
        new MediaImportTelemetryReporter(deps.telemetry, errorNames, deps.storageFootprintProbe),
      ),
      remove: new RemoveMediaAssetAction(deps.store, assets, repository, bytes, preparer, uploader, libraryTelemetry),
      move,
      load,
    },
  };
}

export function buildMediaIndexedDbStoreDefinitions(): IndexedDbStoreDefinition[] {
  return [
    { name: MEDIA_ASSETS_STORE, keyPath: 'id' },
    { name: MEDIA_ASSET_BYTES_STORE, keyPath: 'key' },
  ];
}
