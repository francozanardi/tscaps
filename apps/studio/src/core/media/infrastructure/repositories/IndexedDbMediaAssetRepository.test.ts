import { describe, expect, it } from 'vitest';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { FakeIndexedDbClient } from '@core/_shared/infrastructure/FakeIndexedDbClient';
import { ProjectDependentStores } from '@core/_shared/infrastructure/ProjectDependentStores';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import {
  IndexedDbMediaAssetBytesRepository,
  MEDIA_ASSET_BYTES_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetBytesRepository';
import { LOCAL_MEDIA_ASSET_REALM } from '@core/media/domain/MediaAssetRealm';
import { FixedMediaAssetRealm } from '@core/media/infrastructure/FixedMediaAssetRealm';
import {
  IndexedDbMediaAssetRepository,
  MEDIA_ASSETS_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetRepository';
import { IndexedDbVideoBlobCache } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';

/**
 * On the device, a project's files live exactly as long as its video
 * does: when the video cache lets the project go, its files go with it,
 * record and bytes. The library's are not the project's, and nothing
 * evicts them — they go only when deleted. A file moved between the two
 * lives by its new owner's rule from then on. Nor does eviction take a
 * file this device has not sent yet where its list lives: its copy here
 * is the only one.
 */

const READABLE: BlobReadabilityProbe = { probe: () => Promise.resolve('readable') };

function assetOwnedBy(id: string, owner: MediaAssetOwner): MediaAsset {
  return { id, type: 'video', owner, fileName: `${id}.mp4`, mimeType: 'video/mp4', sizeBytes: 3, widthPx: 1, heightPx: 1, durationSec: 1 };
}

function harness(realm: string = LOCAL_MEDIA_ASSET_REALM) {
  const db = new FakeIndexedDbClient({ [MEDIA_ASSETS_STORE]: 'id', [MEDIA_ASSET_BYTES_STORE]: 'key' });
  const repository = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm(realm));
  const bytes = new IndexedDbMediaAssetBytesRepository(db.asClient(), READABLE, repository);
  const dependents = new ProjectDependentStores();
  dependents.add(repository);
  dependents.add(bytes);
  const keep = async (asset: MediaAsset) => {
    await repository.add(asset);
    await bytes.store(asset, 'original', new Blob([asset.id]));
  };
  const has = async (id: string, listedFor: string) => ({
    listed: (await repository.list(listedFor)).some((asset) => asset.id === id),
    bytes: (await bytes.load(id, 'original')) !== null,
  });
  return { repository, bytes, dependents, keep, has };
}

describe('media files on the device', () => {
  it("drop a project's own files with its video, and keep the library's", async () => {
    const { dependents, keep, has } = harness();
    await keep(assetOwnedBy('evicted', { kind: 'project', projectId: 'a' }));
    await keep(assetOwnedBy('kept', { kind: 'project', projectId: 'b' }));
    await keep(assetOwnedBy('library', { kind: 'library' }));

    await dependents.retainOnly(new Set(['b']));

    expect(await has('evicted', 'a')).toEqual({ listed: false, bytes: false });
    expect(await has('kept', 'b')).toEqual({ listed: true, bytes: true });
    expect(await has('library', 'a')).toEqual({ listed: true, bytes: true });
  });

  it('keep an audio file as it was added, with no size in pixels', async () => {
    const { repository, keep } = harness();
    const sound: MediaAsset = {
      ...assetOwnedBy('theme', { kind: 'library' }), type: 'audio', mimeType: 'audio/flac', widthPx: null, heightPx: null, durationSec: 184.5,
    };
    await keep(sound);

    expect(await repository.list('any')).toEqual([sound]);
  });

  it("keep a file moved to the library when its old project goes", async () => {
    const { repository, bytes, dependents, keep, has } = harness();
    const asset = assetOwnedBy('moved', { kind: 'project', projectId: 'a' });
    await keep(asset);

    await repository.move(asset, { kind: 'library' });
    await bytes.reassign(asset.id, { kind: 'library' });
    await dependents.deleteProject('a');

    expect(await has('moved', 'other')).toEqual({ listed: true, bytes: true });
  });

  it("list a project's own files beside the library's, and never another project's", async () => {
    const { repository, keep } = harness();
    await keep(assetOwnedBy('mine', { kind: 'project', projectId: 'a' }));
    await keep(assetOwnedBy('theirs', { kind: 'project', projectId: 'b' }));
    await keep(assetOwnedBy('library', { kind: 'library' }));

    expect((await repository.list('a')).map((asset) => asset.id).sort()).toEqual(['library', 'mine']);
    expect((await repository.list(null)).map((asset) => asset.id)).toEqual(['library']);
  });

  it('keep a project file not sent yet when its video goes, and drop it with its project', async () => {
    const { dependents, keep, has } = harness('elsewhere');
    await keep(assetOwnedBy('unsent', { kind: 'project', projectId: 'a' }));

    await dependents.retainOnly(new Set());
    expect(await has('unsent', 'a')).toEqual({ listed: true, bytes: true });

    await dependents.deleteProject('a');
    expect(await has('unsent', 'a')).toEqual({ listed: false, bytes: false });
  });
});

describe('a media file moved on the device', () => {
  it('stays in the realm it was written in, whoever moved it', async () => {
    const db = new FakeIndexedDbClient({ [MEDIA_ASSETS_STORE]: 'id' });
    const writer = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm('user:first'));
    const mover = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm('user:second'));
    const asset = assetOwnedBy('theirs', { kind: 'project', projectId: 'a' });
    await writer.add(asset);

    await mover.move(asset, { kind: 'library' });

    expect((await writer.list(null)).map(({ id, owner }) => [id, owner.kind])).toEqual([['theirs', 'library']]);
    expect(await mover.list(null)).toEqual([]);
  });
});

describe('media files on the device, when the video cache lets their project go', () => {
  function cacheHarness(realm: string) {
    const db = new FakeIndexedDbClient({
      [MEDIA_ASSETS_STORE]: 'id',
      [MEDIA_ASSET_BYTES_STORE]: 'key',
      videos: 'projectId',
      'videos-access': 'projectId',
    });
    const repository = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm(realm));
    const bytes = new IndexedDbMediaAssetBytesRepository(db.asClient(), READABLE, repository);
    const dependents = new ProjectDependentStores();
    dependents.add(repository);
    dependents.add(bytes);
    const videos = new IndexedDbVideoBlobCache(db.asClient(), READABLE, 1, dependents);
    const keep = async (asset: MediaAsset) => {
      await repository.add(asset);
      await bytes.store(asset, 'original', new Blob([asset.id]));
    };
    const has = async (id: string, listedFor: string) => ({
      listed: (await repository.list(listedFor)).some((asset) => asset.id === id),
      bytes: (await bytes.load(id, 'original')) !== null,
    });
    return { videos, keep, has };
  }

  it('keep a file not sent yet when another project takes its video\'s place', async () => {
    const { videos, keep, has } = cacheHarness('elsewhere');
    await videos.store('a', new Blob(['a']));
    await keep(assetOwnedBy('unsent', { kind: 'project', projectId: 'a' }));

    await videos.store('b', new Blob(['b']));

    expect(await has('unsent', 'a')).toEqual({ listed: true, bytes: true });
  });

  it('drop a file not sent yet when its project is deleted', async () => {
    const { videos, keep, has } = cacheHarness('elsewhere');
    await videos.store('a', new Blob(['a']));
    await keep(assetOwnedBy('unsent', { kind: 'project', projectId: 'a' }));

    await videos.delete('a');

    expect(await has('unsent', 'a')).toEqual({ listed: false, bytes: false });
  });

  it('drop a local file with its evicted video', async () => {
    const { videos, keep, has } = cacheHarness(LOCAL_MEDIA_ASSET_REALM);
    await videos.store('a', new Blob(['a']));
    await keep(assetOwnedBy('local', { kind: 'project', projectId: 'a' }));

    await videos.store('b', new Blob(['b']));

    expect(await has('local', 'a')).toEqual({ listed: false, bytes: false });
  });
});
