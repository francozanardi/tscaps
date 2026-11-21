import type { BuiltinSound } from '@core/audio-mix/domain/BuiltinSound';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import { BUILTIN_SOUND_CATEGORIES, type BuiltinSoundCategory } from '@core/audio-mix/domain/BuiltinSoundCategory';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAssetDisplayState } from '@presentation/media/services/MediaAssetStatusPresenter';

/**
 * What a sound is picked for. Music is the user's own files only; an
 * effect can be a bundled sound or one of the user's files.
 */
export type SoundPickerMode = 'effect' | 'music';

/** The lists the picker shows, one at a time: the bundled sounds, or the user's audio files. */
export type SoundPickerList = 'builtin' | 'files';

export interface SoundPickerTab {
  readonly value: SoundPickerList;
  readonly label: string;
}

/** A file offered to the picker by a drop or a file dialog: what it is called and the type the system gave it. */
export interface OfferedFile {
  readonly name: string;
  readonly type: string;
}

/** The bundled sounds of one category, in pack order. */
export interface BuiltinSoundGroup {
  readonly category: BuiltinSoundCategory;
  readonly title: string;
  readonly sounds: readonly BuiltinSound[];
}

/**
 * What the sound picker shows and says: which lists it offers for what
 * is being picked, the bundled sounds by category, the user's audio
 * files, and which of them can be picked.
 */
export class SoundPickerPresenter {
  // Some systems give audio files no type, which `audio/*` alone would hide.
  private static readonly AUDIO_EXTENSIONS = ['.m4a', '.opus', '.flac'];

  constructor(private readonly builtinSounds: BuiltinSoundCatalog) {}

  /** What the file dialog accepts, as its `accept` attribute reads. */
  acceptedFiles(): string {
    return ['audio/*', ...SoundPickerPresenter.AUDIO_EXTENSIONS].join(',');
  }

  /**
   * The one file of a drop to add: the first that is a sound, or the
   * first of all where none is, so the import says why it cannot be
   * added. Null where nothing was dropped.
   */
  fileToAddOf<T extends OfferedFile>(files: ReadonlyArray<T>): T | null {
    return files.find((file) => this.isAudio(file)) ?? files[0] ?? null;
  }

  private isAudio(file: OfferedFile): boolean {
    const name = file.name.toLowerCase();
    return file.type.startsWith('audio/') || SoundPickerPresenter.AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension));
  }

  /** The lists offered for `mode`, the first shown first. */
  listsFor(mode: SoundPickerMode): readonly SoundPickerTab[] {
    const files: SoundPickerTab = { value: 'files', label: 'Your files' };
    return mode === 'music' ? [files] : [{ value: 'builtin', label: 'Built-in' }, files];
  }

  /** Every bundled sound, by category in the order categories are offered; a category with no sound is left out. */
  builtinGroups(): readonly BuiltinSoundGroup[] {
    const sounds = this.builtinSounds.list();
    return BUILTIN_SOUND_CATEGORIES
      .map((category) => ({ category, title: this.categoryTitleOf(category), sounds: sounds.filter((sound) => sound.category === category) }))
      .filter((group) => group.sounds.length > 0);
  }

  /** The user's audio files the open project can use, in the order they were added. */
  filesOf(media: MediaAssetCatalog): readonly MediaAsset[] {
    return media.list().filter((asset) => asset.type === 'audio');
  }

  /** Whether a file in `state` can be picked: anything but a file that cannot be played here or is not here at all. */
  canPick(state: MediaAssetDisplayState): boolean {
    return state !== 'unplayable' && state !== 'missing' && state !== 'deleted';
  }

  /** How long a bundled sound plays, in seconds with one decimal: `0.7s`. */
  lengthOf(sound: BuiltinSound): string {
    return `${Math.max(0.1, sound.lengthSec).toFixed(1)}s`;
  }

  /** What the list of the user's files is called where it is the only list. */
  filesTitle(): string {
    return 'Your audio files';
  }

  uploadLabel(): string {
    return 'Upload an audio file';
  }

  uploadingLabel(): string {
    return 'Adding the file…';
  }

  /** What the picker says while a file is dragged over it. */
  dropLabel(): string {
    return 'Drop the file to add it';
  }

  /** What the empty list says under its sentence: how a file gets in. */
  emptyHint(): string {
    return 'Drop a file here, or choose one.';
  }

  /** The kinds of file that can be added. */
  formatsLine(): string {
    return 'MP3, WAV, M4A, OGG or FLAC';
  }

  chooseFileLabel(): string {
    return 'Choose a file';
  }

  /** What the list of the user's files says while it holds none. */
  noFilesLine(mode: SoundPickerMode): string {
    return mode === 'music'
      ? 'You have no audio files yet. Upload a song to use it as music.'
      : 'You have no audio files yet. Upload one to use it as a sound.';
  }

  categoryTitleOf(category: BuiltinSoundCategory): string {
    switch (category) {
      case 'whoosh':
        return 'Whooshes';
      case 'pop':
        return 'Pops';
      case 'ding':
        return 'Dings';
      case 'click':
        return 'Clicks';
      case 'typing':
        return 'Typing';
      case 'writing':
        return 'Writing';
      case 'riser':
        return 'Risers';
      case 'impact':
        return 'Impacts';
      case 'glitch':
        return 'Glitches';
    }
  }
}
