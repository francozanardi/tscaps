import { describe, expect, it } from 'vitest';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { SoundPickerPresenter } from '@presentation/audio-mix/services/SoundPickerPresenter';

/**
 * The picker offers music only from the user's own files, and the
 * bundled sounds in groups a reader can scan; it never offers a file
 * that would play nothing.
 */

const presenter = new SoundPickerPresenter(new StaticFileBuiltinSoundCatalog(
  [
    { id: 'hit', name: 'Hit', category: 'impact', lengthSec: 0.6, description: '', underVoiceVolume: 0.15 },
    { id: 'swish', name: 'Swish', category: 'whoosh', lengthSec: 0.15, description: '', underVoiceVolume: 0.15 },
    { id: 'pop', name: 'Pop', category: 'pop', lengthSec: 0.1, description: '', underVoiceVolume: 0.15 },
    { id: 'whoosh', name: 'Whoosh', category: 'whoosh', lengthSec: 0.7, description: '', underVoiceVolume: 0.15 },
  ],
  '/app/',
));

function asset(id: string, type: MediaAsset['type']): MediaAsset {
  return {
    id, type, owner: { kind: 'library' }, fileName: id, mimeType: '', sizeBytes: 1, widthPx: null, heightPx: null, durationSec: 1,
  };
}

describe('the sound picker', () => {
  it('offers music from the user\'s files alone', () => {
    expect(presenter.listsFor('music').map((list) => list.value)).toEqual(['files']);
  });

  it('offers an effect from the bundled sounds first, then the user\'s files', () => {
    expect(presenter.listsFor('effect').map((list) => list.label)).toEqual(['Built-in', 'Your files']);
  });

  it('groups the bundled sounds by category in the order categories are offered, leaving out empty ones', () => {
    const groups = presenter.builtinGroups();

    expect(groups.map((group) => [group.title, group.sounds.map((sound) => sound.id)])).toEqual([
      ['Whooshes', ['swish', 'whoosh']],
      ['Pops', ['pop']],
      ['Impacts', ['hit']],
    ]);
  });

  it('lists only the user\'s audio files', () => {
    const media = MediaAssetCatalog.of([asset('song', 'audio'), asset('clip', 'video'), asset('still', 'image'), asset('boing', 'audio')]);

    expect(presenter.filesOf(media).map((file) => file.id)).toEqual(['song', 'boing']);
  });

  it('lets a file be picked while it is prepared, never once it cannot play here', () => {
    expect(presenter.canPick('ready')).toBe(true);
    expect(presenter.canPick('preparing')).toBe(true);
    expect(presenter.canPick('unplayable')).toBe(false);
    expect(presenter.canPick('missing')).toBe(false);
    expect(presenter.canPick('deleted')).toBe(false);
  });

  it('adds the first sound of a drop, a file with no type known by its extension', () => {
    const dropped = [
      { name: 'notes.txt', type: 'text/plain' },
      { name: 'Take 2.FLAC', type: '' },
      { name: 'song.mp3', type: 'audio/mpeg' },
    ];

    expect(presenter.fileToAddOf(dropped)?.name).toBe('Take 2.FLAC');
  });

  it('hands a drop holding no sound to the import, which says why it cannot be added', () => {
    expect(presenter.fileToAddOf([{ name: 'clip.mp4', type: 'video/mp4' }])?.name).toBe('clip.mp4');
    expect(presenter.fileToAddOf([])).toBeNull();
  });
});
