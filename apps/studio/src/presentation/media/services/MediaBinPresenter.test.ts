import { describe, expect, it } from 'vitest';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { MediaBinPresenter } from '@presentation/media/services/MediaBinPresenter';

/**
 * The bin's two scopes decide where the reader finds a file: a file the
 * project uses never leaves *This project* for being saved to the
 * library. What it says before a delete or a move out of the library
 * is the reader's only warning about what else the file takes with it.
 */

function asset(id: string, owner: MediaAssetOwner): MediaAsset {
  return {
    id, type: 'video', owner, fileName: `${id}.mp4`, mimeType: 'video/mp4', sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: 1,
  };
}

function layer(id: string, mediaId: string): ShotLayer {
  return { id, mediaId, inSec: 0, outSec: null, loop: false };
}

function clip(id: string, role: AudioClip['role'], mediaId: string): AudioClip {
  return {
    id, role, source: { kind: 'media', mediaId }, start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 }, end: null,
    inSec: 0, loop: false, volume: 1, fadeInSec: 0, fadeOutSec: 0, ducking: { enabled: false, depthDb: -12 },
  };
}

function mixOf(clips: ReadonlyArray<AudioClip>): AudioMix {
  return AudioMix.fromSnapshot({ sourceVolume: 1, clips });
}

const NO_SOUND = AudioMix.empty();
const USED_ONCE = { shots: 2, isMusic: false, soundEffects: 0 };

const presenter = new MediaBinPresenter();

describe('the media bin', () => {
  it('puts a file held for an unsaved session with the project, never in the library', () => {
    const catalog = MediaAssetCatalog.of([
      asset('own', { kind: 'project', projectId: 'p' }),
      asset('shared', { kind: 'library' }),
      asset('unsaved', { kind: 'session' }),
    ]);

    expect(presenter.filesIn(catalog, 'project', new Map()).map((file) => file.id)).toEqual(['own', 'unsaved']);
    expect(presenter.filesIn(catalog, 'library', new Map()).map((file) => file.id)).toEqual(['shared']);
  });

  it('lists in this project the library files its shots show, in the library too', () => {
    const catalog = MediaAssetCatalog.of([
      asset('own', { kind: 'project', projectId: 'p' }),
      asset('saved', { kind: 'library' }),
      asset('elsewhere', { kind: 'library' }),
    ]);
    const partition = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{ id: 'a', startSec: 0, layers: [layer('1', 'saved')] }],
    });
    const usage = presenter.usageOf(partition, NO_SOUND);

    expect(presenter.filesIn(catalog, 'project', usage).map((file) => file.id)).toEqual(['own', 'saved']);
    expect(presenter.filesIn(catalog, 'library', usage).map((file) => file.id)).toEqual(['saved', 'elsewhere']);
  });

  it('keeps a file the project owns in this project whether a shot shows it or not', () => {
    const catalog = MediaAssetCatalog.of([asset('own', { kind: 'project', projectId: 'p' })]);

    expect(presenter.filesIn(catalog, 'project', new Map()).map((file) => file.id)).toEqual(['own']);
    expect(presenter.filesIn(catalog, 'project', new Map([['own', USED_ONCE]])).map((file) => file.id)).toEqual(['own']);
  });

  it('counts shots, not layers, so a shot showing a file twice counts once', () => {
    const partition = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [layer('1', 'clip'), layer('2', 'clip')] },
        { id: 'b', startSec: 4, layers: [layer('3', 'clip'), layer('4', 'still')] },
        { id: 'c', startSec: 8 },
      ],
    });

    const usage = presenter.usageOf(partition, NO_SOUND);

    expect(usage.get('clip')?.shots).toBe(2);
    expect(usage.get('still')?.shots).toBe(1);
    expect(usage.has('unused')).toBe(false);
  });

  it('counts a file the soundtrack plays as used: as the music, or by each sound effect', () => {
    const mix = mixOf([clip('m', 'music', 'song'), clip('e1', 'effect', 'boing'), clip('e2', 'effect', 'boing')]);

    const usage = presenter.usageOf(ShotPartition.empty(), mix);

    expect(usage.get('song')).toEqual({ shots: 0, isMusic: true, soundEffects: 0 });
    expect(usage.get('boing')).toEqual({ shots: 0, isMusic: false, soundEffects: 2 });
  });

  it('lists in this project a library file only its soundtrack plays', () => {
    const catalog = MediaAssetCatalog.of([asset('song', { kind: 'library' }), asset('elsewhere', { kind: 'library' })]);
    const usage = presenter.usageOf(ShotPartition.empty(), mixOf([clip('m', 'music', 'song')]));

    expect(presenter.filesIn(catalog, 'project', usage).map((file) => file.id)).toEqual(['song']);
  });

  it('says which sounds go with a file before it is deleted', () => {
    const message = presenter.deleteMessage(
      asset('song', { kind: 'project', projectId: 'p' }),
      { shots: 0, isMusic: true, soundEffects: 2 },
    );

    expect(message).toContain('It is the music of this project. The music is removed with the file.');
    expect(message).toContain('2 sound effects in this project play it.');
  });

  it('says how many shots lose a file before it is deleted', () => {
    const message = presenter.deleteMessage(asset('clip', { kind: 'project', projectId: 'p' }), { shots: 3, isMusic: false, soundEffects: 0 });

    expect(message).toContain('3 shots in this project show it');
    expect(message).not.toContain('Other projects');
  });

  it('warns that other projects may use a library file', () => {
    const message = presenter.deleteMessage(asset('clip', { kind: 'library' }), undefined);

    expect(message).toContain('Other projects may use it too');
    expect(message).not.toContain('shot');
  });

  it('warns that other projects lose a library file kept only in this project', () => {
    expect(presenter.keepOnlyInProjectMessage()).toContain('Other projects may use it too');
  });

  it('offers to show a file on the current shot once there are shots, and never a sound', () => {
    const video = asset('clip', { kind: 'library' });
    const sound: MediaAsset = { ...video, id: 'theme', type: 'audio', widthPx: null, heightPx: null };

    expect(presenter.offersAddToShot(video, true)).toBe(true);
    expect(presenter.offersAddToShot(video, false)).toBe(false);
    expect(presenter.offersAddToShot(sound, true)).toBe(false);
  });

  it('offers a sound as music unless it already is the music, and never a picture', () => {
    const video = asset('clip', { kind: 'library' });
    const sound: MediaAsset = { ...video, id: 'theme', type: 'audio', widthPx: null, heightPx: null };
    const usage = presenter.usageOf(ShotPartition.empty(), mixOf([clip('m', 'music', 'theme'), clip('e', 'effect', 'other')]));

    expect(presenter.offersUseAsMusic(sound, undefined)).toBe(true);
    expect(presenter.offersUseAsMusic(sound, usage.get('theme'))).toBe(false);
    expect(presenter.offersUseAsMusic({ ...sound, id: 'other' }, usage.get('other'))).toBe(true);
    expect(presenter.offersUseAsMusic(video, undefined)).toBe(false);
  });

  it('never promises a library reachable from other devices where it is kept on this one', () => {
    expect(presenter.scopeHint('library', false)).toContain('this device');
    expect(presenter.scopeHint('library', true)).not.toContain('device');
  });
});
