import { describe, expect, it } from 'vitest';
import { MediaLibraryTelemetryReporter } from '@core/media/services/MediaLibraryTelemetryReporter';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { FakeIndexedDbClient } from '@core/_shared/infrastructure/FakeIndexedDbClient';
import { EditorStore } from '@core/editor/store/EditorStore';
import { RemoveMediaAssetAction } from '@core/media/actions/RemoveMediaAssetAction';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
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
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';

const PLAYS = { ensurePlayable: async () => undefined };

/**
 * A deleted file leaves everywhere it was: the list, its bytes here, and
 * the remote copy, whose delete is recorded before anything here goes.
 * And no shot or clip of the soundtrack names it any more in any step of
 * the history, so no undo or redo can bring back one pointing at a file
 * that is gone.
 */

const CLIP: MediaAsset = {
  id: 'clip',
  type: 'video',
  owner: { kind: 'project', projectId: 'project' },
  fileName: 'clip.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 3,
  widthPx: 640,
  heightPx: 360,
  durationSec: 2,
};
const CLIP_LAYER: ShotLayer = { id: 'layer', mediaId: 'clip', inSec: 0, outSec: null, loop: false };
const CLIP_SOUND: AudioClip = {
  id: 'sound',
  role: 'music',
  source: { kind: 'media', mediaId: 'clip' },
  start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
  end: null,
  inSec: 0,
  loop: true,
  volume: 1,
  fadeInSec: 0,
  fadeOutSec: 0,
  ducking: { enabled: false, depthDb: -12 },
};
const READABLE: BlobReadabilityProbe = { probe: () => Promise.resolve('readable') };

/** Notes whether the file's bytes were still on the device when its remote delete was recorded. */
class RemoteDeleteRecorder extends DeviceOnlyMediaAssetUploader {
  bytes: IndexedDbMediaAssetBytesRepository | null = null;
  bytesKeptWhenRecorded: boolean | null = null;

  override async remove(): Promise<void> {
    this.bytesKeptWhenRecorded = (await this.bytes?.load(CLIP.id, 'original')) != null;
  }
}

async function harness(usedByShot: boolean, uploader: MediaAssetUploader = new DeviceOnlyMediaAssetUploader()) {
  const db = new FakeIndexedDbClient({ [MEDIA_ASSETS_STORE]: 'id', [MEDIA_ASSET_BYTES_STORE]: 'key' });
  const repository = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm(LOCAL_MEDIA_ASSET_REALM));
  const bytes = new IndexedDbMediaAssetBytesRepository(db.asClient(), READABLE, repository);
  await repository.add(CLIP);
  await bytes.store(CLIP, 'original', new Blob(['clip']));
  const assets = new MediaAssetStore();
  assets.put(CLIP);
  const store = new EditorStore();
  store.patch({
    projectId: 'project',
    shots: usedByShot
      ? ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'shot', startSec: 0, layers: [CLIP_LAYER] }] })
      : ShotPartition.empty(),
  });
  const preparer = new MediaAssetPreparer(bytes, {} as PreviewProxyGenerator, uploader, PLAYS, PLAYS);
  const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  const action = new RemoveMediaAssetAction(
    store, assets, repository, bytes, preparer, uploader,
    new MediaLibraryTelemetryReporter({ capture: (name, properties) => { events.push([name, properties]); } }),
  );
  return { store, assets, repository, bytes, action, events };
}

describe('deleting a media file', () => {
  it('reports the delete by the file\'s kind and whether the project used it, never by its name', async () => {
    const { action, events } = await harness(true);

    await action.execute('clip');

    expect(events).toEqual([['media_file_deleted', {
      type: CLIP.type,
      owner: CLIP.owner.kind,
      was_in_use: true,
      was_preparing: false,
    }]]);
    expect(JSON.stringify(events)).not.toContain(CLIP.fileName);
  });

  it('drops it from the list and from this device', async () => {
    const { assets, repository, bytes, action } = await harness(false);

    await action.execute('clip');

    expect(assets.snapshot().get('clip')).toBeNull();
    expect(await repository.list('project')).toEqual([]);
    expect(await bytes.load('clip', 'original')).toBeNull();
  });

  it('records the remote delete before anything of it leaves this device', async () => {
    const uploader = new RemoteDeleteRecorder();
    const { bytes, action } = await harness(false, uploader);
    uploader.bytes = bytes;

    await action.execute('clip');

    expect(uploader.bytesKeptWhenRecorded).toBe(true);
  });

  it('takes it off the shots that show it, and no undo or redo puts it back', async () => {
    const { store, action } = await harness(true);
    store.commit('Edit');
    store.patch({ shots: store.snapshot().shots.withoutLayers([CLIP_LAYER.id]) });
    store.commit('Edit');
    store.patch({ shots: store.snapshot().shots.withLayerAdded('shot', CLIP_LAYER) });

    await action.execute('clip');

    expect(store.snapshot().shots.mediaIdsInUse().size).toBe(0);
    expect(store.snapshot().dirty).toBe(true);
    store.undo();
    store.undo();
    expect(store.snapshot().shots.mediaIdsInUse().size).toBe(0);
    store.redo();
    store.redo();
    expect(store.snapshot().shots.mediaIdsInUse().size).toBe(0);
  });

  it('takes it off the soundtrack, and no undo or redo puts it back', async () => {
    const { store, action } = await harness(false);
    store.commit('Edit');
    store.patch({ audio: AudioMix.empty().withClipAdded(CLIP_SOUND) });
    store.commit('Edit');
    store.patch({ audio: store.snapshot().audio.withClipsPatched([CLIP_SOUND.id], { volume: 0.5 }) });
    store.markClean();

    await action.execute('clip');

    expect(store.snapshot().audio.hasClips()).toBe(false);
    expect(store.snapshot().dirty).toBe(true);
    store.undo();
    store.undo();
    expect(store.snapshot().audio.hasClips()).toBe(false);
    store.redo();
    store.redo();
    expect(store.snapshot().audio.hasClips()).toBe(false);
  });
});
