import { describe, expect, it } from 'vitest';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { FakeIndexedDbClient } from '@core/_shared/infrastructure/FakeIndexedDbClient';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ImportMediaAssetAction } from '@core/media/actions/ImportMediaAssetAction';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import { MediaImportTelemetryReporter } from '@core/media/services/MediaImportTelemetryReporter';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';
import type { ImageDimensionsProbe } from '@core/media/domain/ImageDimensionsProbe';
import { MediaAssetLimits } from '@core/media/domain/MediaAssetLimits';
import type { MediaLibraryAccess } from '@core/media/domain/MediaLibraryAccess';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { OpenMediaLibraryAccess } from '@core/media/infrastructure/OpenMediaLibraryAccess';
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
import { SessionHeldMediaAssetBytesRepository } from '@core/media/infrastructure/repositories/SessionHeldMediaAssetBytesRepository';
import { MediaAssetOwnerResolver } from '@core/media/services/MediaAssetOwnerResolver';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetTypeDetector } from '@core/media/services/MediaAssetTypeDetector';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Each kind of file is read its own way: a video must be a readable one
 * no longer than a video may run, and is ready once its proxy is made; a
 * picture or a GIF needs nothing made and is ready at once, previewed
 * from its own bytes; an audio file must hold sound no longer than an
 * audio file may run, has no size in pixels, and is ready once its sound
 * is found to decode here. A file of a kind the editor does not take, or
 * heavier than its kind may be, is refused before anything is kept, and
 * so is a file added to a library that is not open to whoever uses the
 * editor. Adding a file is not an edit.
 */

const VIDEO = new File(['video'], 'beach.mp4', { type: 'video/mp4' });
const PICTURE = new File(['png'], 'logo.png', { type: 'image/png' });
const GIF = new File(['gif'], 'wave.gif', { type: 'image/gif' });
const AUDIO = new File(['mp3'], 'theme.mp3', { type: 'audio/mpeg' });

const FOOTAGE: Partial<VideoSourceMetadata> = { videoWidthPx: 1920, videoHeightPx: 1080, hasAudioTrack: true };
const SOUND_ONLY: Partial<VideoSourceMetadata> = { videoWidthPx: null, videoHeightPx: null, hasAudioTrack: true };

/** A probe answering what `durationSeconds` and `contents` say for any file it is given. */
function metadataProbe(durationSeconds: number | null, contents: Partial<VideoSourceMetadata>): VideoMetadataProbe {
  return {
    probe: () => Promise.resolve({ sourceReadable: true, durationSeconds, mimeType: null, ...contents } as VideoSourceMetadata),
  };
}

function audioProbe(plays: boolean): AudioPlaybackProbe {
  return { ensurePlayable: () => (plays ? Promise.resolve() : Promise.reject(new Error('no decoder reads this'))) };
}

const PICTURE_PROBE: ImageDimensionsProbe = { probe: () => Promise.resolve({ widthPx: 512, heightPx: 256 }) };
const READABLE: BlobReadabilityProbe = { probe: () => Promise.resolve('readable') };
const CLOSED_LIBRARY: MediaLibraryAccess = { isOpen: () => false };

interface HarnessOptions {
  projectId?: string | null;
  durationSeconds?: number | null;
  /** What the probe finds in any file it reads; footage with sound unless given. */
  contents?: Partial<VideoSourceMetadata>;
  pictureProbe?: ImageDimensionsProbe;
  /** Whether audio files decode here; they do unless given. */
  audioPlays?: boolean;
  library?: MediaLibraryAccess;
}

function harness(options: HarnessOptions = {}) {
  const db = new FakeIndexedDbClient({ [MEDIA_ASSETS_STORE]: 'id', [MEDIA_ASSET_BYTES_STORE]: 'key' });
  const repository = new IndexedDbMediaAssetRepository(db.asClient(), new FixedMediaAssetRealm(LOCAL_MEDIA_ASSET_REALM));
  const bytes = new SessionHeldMediaAssetBytesRepository(new IndexedDbMediaAssetBytesRepository(db.asClient(), READABLE, repository));
  const proxiesMade: string[] = [];
  const generator = {
    generate: (source: Blob) => {
      proxiesMade.push(source.type);
      return Promise.resolve({ blob: new Blob(['proxy'], { type: 'video/mp4' }), mimeType: 'video/mp4', widthPx: 1, heightPx: 1 });
    },
  } as unknown as PreviewProxyGenerator;
  const uploader = new DeviceOnlyMediaAssetUploader();
  const preparer = new MediaAssetPreparer(bytes, generator, uploader, { ensurePlayable: async () => undefined }, audioProbe(options.audioPlays ?? true));
  const editorStore = new EditorStore();
  editorStore.patch({ projectId: options.projectId === undefined ? 'project' : options.projectId });
  const assets = new MediaAssetStore();
  const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  const action = new ImportMediaAssetAction(
    editorStore,
    assets,
    repository,
    bytes,
    new MediaAssetTypeDetector(),
    metadataProbe(options.durationSeconds === undefined ? 4 : options.durationSeconds, options.contents ?? FOOTAGE),
    options.pictureProbe ?? PICTURE_PROBE,
    new MediaAssetOwnerResolver(options.library ?? new OpenMediaLibraryAccess()),
    uploader,
    preparer,
    new MediaImportTelemetryReporter(
      { capture: (name, properties) => { events.push([name, properties]); } },
      new ErrorNameTelemetryDescriber(),
      { measure: async () => ({ storage_persisted: false }) } as unknown as StorageFootprintProbe,
    ),
  );
  return { action, assets, repository, bytes, preparer, proxiesMade, editorStore, events };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('importing a media file', () => {
  it('reports a file added by its kind, weight and size, never by its name', async () => {
    const { action, events } = harness();

    await action.execute(VIDEO, 'library', 'bin-drop');

    expect(events).toEqual([['media_file_added', {
      type: 'video',
      mime_type: 'video/mp4',
      size_mb: 0,
      duration_s: 4,
      width: 1920,
      height: 1080,
      owner: 'library',
      destination: 'library',
      origin: 'bin-drop',
    }]]);
    expect(JSON.stringify(events)).not.toContain('beach');
  });

  it('reports a file refused by the gate it met, never by its name', async () => {
    const { action, events } = harness({ durationSeconds: MediaAssetLimits.MAX_DURATION_SEC.video + 1 });

    await expect(action.execute(VIDEO, 'project', 'shot-upload', ['video'])).rejects.toMatchObject({ name: 'MediaAssetImportFailedError' });
    await settle();

    expect(events).toEqual([['media_file_add_failed', {
      type: 'video',
      mime_type: 'video/mp4',
      size_mb: 0,
      destination: 'project',
      origin: 'shot-upload',
      error_name: 'MediaAssetImportFailedError',
      error_cause_name: 'MediaAssetTooLongError',
      http_status: null,
      storage_persisted: false,
    }]]);
    expect(JSON.stringify(events)).not.toContain('beach');
  });

  it('records a video with its size and length, and makes it ready through a proxy', async () => {
    const { action, repository, preparer, proxiesMade } = harness();

    const asset = await action.execute(VIDEO, 'project', 'bin-picker');
    await settle();

    expect(asset).toMatchObject({ type: 'video', widthPx: 1920, heightPx: 1080, durationSec: 4 });
    expect((await repository.list('project')).map((listed) => listed.id)).toEqual([asset.id]);
    expect(proxiesMade).toEqual(['video/mp4']);
    expect(preparer.statusOf(asset.id)?.phase).toBe('ready');
  });

  it('records a picture and a GIF with their size, ready at once with nothing made', async () => {
    const { action, preparer, proxiesMade } = harness();

    const picture = await action.execute(PICTURE, 'project', 'bin-picker');
    const gif = await action.execute(GIF, 'project', 'bin-picker');
    await settle();

    expect(picture).toMatchObject({ type: 'image', widthPx: 512, heightPx: 256, durationSec: null });
    expect(gif).toMatchObject({ type: 'gif', widthPx: 512, heightPx: 256, durationSec: null });
    expect(proxiesMade).toEqual([]);
    expect(preparer.statusOf(picture.id)?.phase).toBe('ready');
    expect(preparer.statusOf(gif.id)?.phase).toBe('ready');
  });

  it('refuses a video longer than a video may run, or that will not say, and keeps nothing', async () => {
    for (const durationSeconds of [MediaAssetLimits.MAX_DURATION_SEC.video + 1, null]) {
      const { action, assets } = harness({ durationSeconds });

      await expect(action.execute(VIDEO, 'project', 'bin-picker')).rejects.toMatchObject({
        name: 'MediaAssetImportFailedError',
        cause: { name: 'MediaAssetTooLongError' },
      });
      expect(assets.snapshot().isEmpty()).toBe(true);
    }
  });

  it('refuses a file of a kind the place it was added for does not take, and keeps nothing', async () => {
    const { action, assets } = harness();

    await expect(action.execute(VIDEO, 'project', 'bin-picker', ['image', 'gif'])).rejects.toMatchObject({
      cause: { name: 'MediaAssetNotAcceptedHereError' },
    });
    await expect(action.execute(PICTURE, 'project', 'bin-picker', ['video'])).rejects.toMatchObject({
      cause: { name: 'MediaAssetNotAcceptedHereError' },
    });
    expect(assets.snapshot().isEmpty()).toBe(true);
  });

  it('refuses a file of a kind the editor does not take', async () => {
    const { action, assets } = harness();

    await expect(action.execute(new File(['x'], 'notes.pdf', { type: 'application/pdf' }), 'project', 'bin-picker')).rejects.toMatchObject({
      cause: { name: 'MediaAssetUnsupportedTypeError' },
    });
    expect(assets.snapshot().isEmpty()).toBe(true);
  });

  it('refuses a picture heavier than a picture may be', async () => {
    const { action, assets } = harness();
    const heavy = new File(['png'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(heavy, 'size', { value: MediaAssetLimits.MAX_BYTES.image + 1 });

    await expect(action.execute(heavy, 'project', 'bin-picker')).rejects.toMatchObject({ cause: { name: 'MediaAssetTooLargeError' } });
    expect(assets.snapshot().isEmpty()).toBe(true);
  });

  it('refuses a picture wider or taller than a file may be, and keeps nothing', async () => {
    const side = MediaAssetLimits.MAX_SIDE_PX;
    for (const size of [{ widthPx: side + 1, heightPx: 10 }, { widthPx: 10, heightPx: side + 1 }]) {
      const { action, assets } = harness({ pictureProbe: { probe: () => Promise.resolve(size) } });

      await expect(action.execute(PICTURE, 'project', 'bin-picker')).rejects.toMatchObject({ cause: { name: 'MediaAssetTooManyPixelsError' } });
      expect(assets.snapshot().isEmpty()).toBe(true);
    }
    const { action } = harness({ pictureProbe: { probe: () => Promise.resolve({ widthPx: side, heightPx: side }) } });
    await expect(action.execute(PICTURE, 'project', 'bin-picker')).resolves.toMatchObject({ widthPx: side });
  });

  it('records an audio file with its length and no size in pixels, ready once it is found to play, with nothing made', async () => {
    const { action, preparer, proxiesMade } = harness({ durationSeconds: 184, contents: SOUND_ONLY });

    const asset = await action.execute(AUDIO, 'project', 'bin-picker');
    await settle();

    expect(asset).toMatchObject({ type: 'audio', mimeType: 'audio/mpeg', widthPx: null, heightPx: null, durationSec: 184 });
    expect(proxiesMade).toEqual([]);
    expect(preparer.statusOf(asset.id)?.phase).toBe('ready');
  });

  it('keeps an audio file this browser cannot decode, as one that cannot play here', async () => {
    const { action, preparer } = harness({ contents: SOUND_ONLY, audioPlays: false });

    const asset = await action.execute(AUDIO, 'project', 'bin-picker');
    await settle();

    expect(preparer.statusOf(asset.id)?.phase).toBe('unplayable');
  });

  it('tells an audio file with no type from its extension', async () => {
    const { action } = harness({ contents: SOUND_ONLY });

    for (const [name, mimeType] of [['take.flac', 'audio/flac'], ['take.opus', 'audio/ogg'], ['take.m4a', 'audio/mp4'], ['take.wav', 'audio/wav']]) {
      await expect(action.execute(new File(['x'], name!), 'project', 'bin-picker')).resolves.toMatchObject({ type: 'audio', mimeType });
    }
  });

  it('refuses an audio file longer than an audio file may run, or that will not say, and keeps nothing', async () => {
    for (const durationSeconds of [MediaAssetLimits.MAX_DURATION_SEC.audio + 1, null]) {
      const { action, assets } = harness({ durationSeconds, contents: SOUND_ONLY });

      await expect(action.execute(AUDIO, 'project', 'bin-picker')).rejects.toMatchObject({
        cause: { name: 'MediaAssetTooLongError', type: 'audio' },
      });
      expect(assets.snapshot().isEmpty()).toBe(true);
    }
    const { action } = harness({ durationSeconds: MediaAssetLimits.MAX_DURATION_SEC.audio, contents: SOUND_ONLY });
    await expect(action.execute(AUDIO, 'project', 'bin-picker')).resolves.toMatchObject({ type: 'audio' });
  });

  it('refuses an audio file heavier than an audio file may be', async () => {
    const { action, assets } = harness({ contents: SOUND_ONLY });
    const heavy = new File(['mp3'], 'long.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(heavy, 'size', { value: MediaAssetLimits.MAX_BYTES.audio + 1 });

    await expect(action.execute(heavy, 'project', 'bin-picker')).rejects.toMatchObject({ cause: { name: 'MediaAssetTooLargeError', type: 'audio' } });
    expect(assets.snapshot().isEmpty()).toBe(true);
  });

  it('refuses an audio file that holds no sound, and keeps nothing', async () => {
    const { action, assets } = harness({ contents: { hasAudioTrack: false } });

    await expect(action.execute(AUDIO, 'project', 'bin-picker')).rejects.toMatchObject({ name: 'MediaAssetImportFailedError' });
    expect(assets.snapshot().isEmpty()).toBe(true);
  });

  it('takes a WebM or MP4 holding sound and no picture as an audio file, whatever the browser named it', async () => {
    const { action } = harness({ durationSeconds: 300, contents: SOUND_ONLY });

    const webm = await action.execute(new File(['webm'], 'voice.webm', { type: 'video/webm' }), 'project', 'bin-picker');
    const mp4 = await action.execute(new File(['mp4'], 'voice.mp4', { type: 'video/mp4' }), 'project', 'bin-picker');

    expect(webm).toMatchObject({ type: 'audio', mimeType: 'audio/webm', widthPx: null, durationSec: 300 });
    expect(mp4).toMatchObject({ type: 'audio', mimeType: 'audio/mp4' });
  });

  it('refuses a WebM holding only sound where only a video is taken, and any other video holding no picture', async () => {
    const { action, assets } = harness({ contents: SOUND_ONLY });

    await expect(action.execute(new File(['webm'], 'voice.webm', { type: 'video/webm' }), 'project', 'bin-picker', ['video'])).rejects.toMatchObject({
      cause: { name: 'MediaAssetNotAcceptedHereError', type: 'audio' },
    });
    await expect(action.execute(new File(['mov'], 'voice.mov', { type: 'video/quicktime' }), 'project', 'bin-picker')).rejects.toMatchObject({
      name: 'MediaAssetImportFailedError',
    });
    expect(assets.snapshot().isEmpty()).toBe(true);
  });

  it('refuses an audio file where only pictures are taken, before reading it', async () => {
    const { action } = harness({ contents: SOUND_ONLY });

    await expect(action.execute(AUDIO, 'project', 'bin-picker', ['image', 'gif'])).rejects.toMatchObject({
      cause: { name: 'MediaAssetNotAcceptedHereError', type: 'audio' },
    });
  });

  it('gives a file to the library when asked, which every project then lists', async () => {
    const { action, repository } = harness();

    const asset = await action.execute(PICTURE, 'library', 'bin-picker');

    expect(asset.owner).toEqual({ kind: 'library' });
    expect((await repository.list('another-project')).map((listed) => listed.id)).toEqual([asset.id]);
  });

  it('refuses a file added to a library that is not open, before reading or keeping anything', async () => {
    const { action, assets, repository, proxiesMade } = harness({ library: CLOSED_LIBRARY });

    await expect(action.execute(VIDEO, 'library', 'bin-picker')).rejects.toMatchObject({
      name: 'MediaAssetImportFailedError',
      cause: { name: 'MediaLibraryUnavailableError' },
    });

    expect(assets.snapshot().isEmpty()).toBe(true);
    expect(await repository.list(null)).toEqual([]);
    expect(proxiesMade).toEqual([]);
  });

  it('still adds a file to the open project while the library is not open', async () => {
    const { action } = harness({ library: CLOSED_LIBRARY, projectId: null });

    await expect(action.execute(PICTURE, 'project', 'bin-picker')).resolves.toMatchObject({ owner: { kind: 'session' } });
  });

  it('holds a file added to a project with no id for the page alone, and still plays it', async () => {
    const { action, assets, repository, bytes } = harness({ projectId: null });

    const asset = await action.execute(PICTURE, 'project', 'bin-picker');

    expect(asset.owner).toEqual({ kind: 'session' });
    expect(assets.snapshot().get(asset.id)).not.toBeNull();
    expect(await repository.list(null)).toEqual([]);
    expect(await bytes.load(asset.id, 'original')).not.toBeNull();
  });

  it('is not an edit undo takes back', async () => {
    const { action, assets, editorStore } = harness();
    editorStore.commit('Edit');

    const asset = await action.execute(VIDEO, 'project', 'bin-picker');
    editorStore.undo();

    expect(assets.snapshot().get(asset.id)).not.toBeNull();
  });
});
