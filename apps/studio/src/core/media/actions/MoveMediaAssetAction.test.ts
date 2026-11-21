import { describe, expect, it } from 'vitest';
import { MediaLibraryTelemetryReporter } from '@core/media/services/MediaLibraryTelemetryReporter';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { FakeIndexedDbClient } from '@core/_shared/infrastructure/FakeIndexedDbClient';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MoveMediaAssetAction } from '@core/media/actions/MoveMediaAssetAction';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { LOCAL_MEDIA_ASSET_REALM } from '@core/media/domain/MediaAssetRealm';
import type { MediaLibraryAccess } from '@core/media/domain/MediaLibraryAccess';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { OpenMediaLibraryAccess } from '@core/media/infrastructure/OpenMediaLibraryAccess';
import { FixedMediaAssetRealm } from '@core/media/infrastructure/FixedMediaAssetRealm';
import {
  IndexedDbMediaAssetBytesRepository,
  MEDIA_ASSET_BYTES_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetBytesRepository';
import {
  IndexedDbMediaAssetRepository,
  MEDIA_ASSETS_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetRepository';
import { SessionHeldMediaAssetBytesRepository } from '@core/media/infrastructure/repositories/SessionHeldMediaAssetBytesRepository';
import { MediaAssetOwnerResolver } from '@core/media/services/MediaAssetOwnerResolver';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';

/**
 * A file added before its project had an id lives only in the page; once
 * given to the project it has to outlive the page. When the device has
 * no room to write it, nothing moves: the file stays the session's, and
 * no record names a project owner whose bytes were never written.
 */

const READABLE: BlobReadabilityProbe = { probe: () => Promise.resolve('readable') };
const HELD: MediaAsset = {
  id: 'clip', type: 'image', owner: { kind: 'session' }, fileName: 'logo.png', mimeType: 'image/png',
  sizeBytes: 3, widthPx: 1, heightPx: 1, durationSec: null,
};

const CLOSED_LIBRARY: MediaLibraryAccess = { isOpen: () => false };

/** A device whose bytes store has no room left. */
class FullDevice extends FakeIndexedDbClient {
  override writeOne(storeName: string, value: object): Promise<void> {
    if (storeName === MEDIA_ASSET_BYTES_STORE) {
      return Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    }
    return super.writeOne(storeName, value);
  }
}

async function harness(options: { library?: MediaLibraryAccess; projectId?: string | null } = {}) {
  const db = new FullDevice({ [MEDIA_ASSETS_STORE]: 'id', [MEDIA_ASSET_BYTES_STORE]: 'key' });
  const repository = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm(LOCAL_MEDIA_ASSET_REALM));
  const bytes = new SessionHeldMediaAssetBytesRepository(new IndexedDbMediaAssetBytesRepository(db.asClient(), READABLE, repository));
  await bytes.store(HELD, 'original', new Blob(['png']));
  const editorStore = new EditorStore();
  editorStore.patch({ projectId: options.projectId === undefined ? 'project' : options.projectId });
  const assets = new MediaAssetStore();
  assets.put(HELD);
  const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  const action = new MoveMediaAssetAction(
    editorStore, assets, repository, bytes, new MediaAssetOwnerResolver(options.library ?? new OpenMediaLibraryAccess()), new DeviceOnlyMediaAssetUploader(),
    new MediaLibraryTelemetryReporter({ capture: (name, properties) => { events.push([name, properties]); } }),
  );
  return { action, assets, repository, bytes, events };
}

describe('moving a file held for the session', () => {
  it('moves nothing when the device has no room for its bytes, and still plays it', async () => {
    const { action, assets, repository, bytes, events } = await harness();

    await expect(action.execute('clip', 'project')).rejects.toMatchObject({ name: 'MediaAssetMoveFailedError' });
    expect(events).toEqual([]);

    expect(assets.snapshot().get('clip')?.owner).toEqual({ kind: 'session' });
    expect(await repository.list('project')).toEqual([]);
    expect(await (await bytes.load('clip', 'original'))?.text()).toBe('png');
  });
});

describe('moving a file to a library that is not open', () => {
  it('refuses, and the file stays where it was', async () => {
    const { action, assets, repository, bytes } = await harness({ library: CLOSED_LIBRARY, projectId: null });

    await expect(action.execute('clip', 'library')).rejects.toMatchObject({
      name: 'MediaAssetMoveFailedError',
      cause: { name: 'MediaLibraryUnavailableError' },
    });

    expect(assets.snapshot().get('clip')?.owner).toEqual({ kind: 'session' });
    expect(await repository.list(null)).toEqual([]);
    expect(await (await bytes.load('clip', 'original'))?.text()).toBe('png');
  });
});
