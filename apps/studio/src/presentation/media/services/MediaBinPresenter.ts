import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { MediaFileUsage } from '@presentation/media/services/MediaFileUsage';

/** Which files the media bin is showing: the open project's, or the user's library. */
export type MediaBinScope = 'project' | 'library';

/** What the bin says while one of its scopes holds no file. */
export interface MediaBinEmptyState {
  readonly title: string;
  readonly hint: string;
}

/**
 * What the media bin shows and says, apart from any one file: which
 * files sit in each scope, what in the project uses each, and the
 * sentences around them.
 */
export class MediaBinPresenter {
  private static readonly OTHER_PROJECTS_LOSE_IT = 'Other projects may use it too. They will show it as missing.';

  /**
   * The files of `scope`, in the order they were added. *This project*
   * lists what the project has or uses: the files it owns (a file held
   * for an unsaved session among them) and the library files a shot of
   * it shows or a sound of it plays, so saving a file to the library
   * never takes it out of the project. *Library* lists every library
   * file.
   *
   * @param usage what in the open project uses each file, as
   *   {@link usageOf} answers it.
   */
  filesIn(catalog: MediaAssetCatalog, scope: MediaBinScope, usage: ReadonlyMap<string, MediaFileUsage>): readonly MediaAsset[] {
    return catalog.list().filter((asset) => {
      const inLibrary = asset.owner.kind === 'library';
      return scope === 'library' ? inLibrary : !inLibrary || usage.has(asset.id);
    });
  }

  /**
   * What in the project uses each file, by id: the shots of `partition`
   * that show it, and the clips of `mix` that play it — as its music or
   * as sound effects. A file nothing uses is absent.
   */
  usageOf(partition: ShotPartition, mix: AudioMix): ReadonlyMap<string, MediaFileUsage> {
    const usage = new Map<string, MediaFileUsage>();
    for (const shot of partition.list()) {
      for (const mediaId of new Set(shot.layers.flatMap((layer) => ('mediaId' in layer ? [layer.mediaId] : [])))) {
        const held = this.heldIn(usage, mediaId);
        usage.set(mediaId, { ...held, shots: held.shots + 1 });
      }
    }
    for (const clip of mix.clips()) {
      if (clip.source.kind !== 'media') continue;
      const held = this.heldIn(usage, clip.source.mediaId);
      usage.set(clip.source.mediaId, clip.role === 'music'
        ? { ...held, isMusic: true }
        : { ...held, soundEffects: held.soundEffects + 1 });
    }
    return usage;
  }

  /**
   * Whether a file's menu offers to show it on the shot under the
   * playhead: anything a shot draws, once the video has shots. A sound
   * is never drawn on a shot.
   */
  offersAddToShot(file: MediaAsset, hasShots: boolean): boolean {
    return hasShots && file.type !== 'audio';
  }

  /**
   * Whether a file's menu offers to make it the project's music: any
   * sound but the one already playing as the music.
   *
   * @param usage what in the open project uses the file, as
   *   {@link usageOf} answers it; undefined where nothing does.
   */
  offersUseAsMusic(file: MediaAsset, usage: MediaFileUsage | undefined): boolean {
    return file.type === 'audio' && usage?.isMusic !== true;
  }

  countLabel(count: number): string {
    return count === 1 ? '1 file' : `${count} files`;
  }

  /**
   * One line under the scope picker saying what the scope is; null where
   * the picker already says it. `libraryReachesOtherDevices` is whether the
   * library is kept remotely, reachable from every device the user signs in on,
   * rather than on this device only; the line never promises the first
   * where it is the second.
   */
  scopeHint(scope: MediaBinScope, libraryReachesOtherDevices: boolean): string | null {
    if (scope === 'project') return null;
    return libraryReachesOtherDevices
      ? 'Files in your library can be used in any of your projects.'
      : 'Files in your library stay on this device. Use them in any project you open here.';
  }

  emptyState(scope: MediaBinScope): MediaBinEmptyState {
    return scope === 'project'
      ? {
        title: 'Drop videos, pictures, GIFs or audio here, or click to choose them',
        hint: 'Then drag a file onto a shot to show it there.',
      }
      : {
        title: 'Your library is empty',
        hint: 'Drop files here, or click to choose them. Files in your library can be used in other projects too.',
      };
  }

  /** What the library scope says in place of its files while the reader cannot use a library. */
  lockedLibraryState(): MediaBinEmptyState {
    return {
      title: 'Your library keeps files for all your projects',
      hint: 'Add a file once and use it in any project.',
    };
  }

  dropLabel(scope: MediaBinScope): string {
    return scope === 'project' ? 'Drop to add to this project' : 'Drop to add to your library';
  }

  /**
   * The question asked before a library file is given to the open
   * project alone: every other project that shows it loses it.
   */
  keepOnlyInProjectMessage(): string {
    return `Keep this file only in this project? ${MediaBinPresenter.OTHER_PROJECTS_LOSE_IT}`;
  }

  /**
   * The question asked before `asset` is deleted: how many shots of the
   * open project lose it, which of its sounds go with it, and, for a
   * library file, that other projects may use it too.
   */
  deleteMessage(asset: MediaAsset, usage: MediaFileUsage | undefined): string {
    const sentences = ['Delete this file?'];
    const shots = usage?.shots ?? 0;
    const soundEffects = usage?.soundEffects ?? 0;
    if (shots === 1) sentences.push('1 shot in this project shows it. The shot stays, without the file.');
    if (shots > 1) sentences.push(`${shots} shots in this project show it. The shots stay, without the file.`);
    if (usage?.isMusic) sentences.push('It is the music of this project. The music is removed with the file.');
    if (soundEffects === 1) sentences.push('1 sound effect in this project plays it. It is removed with the file.');
    if (soundEffects > 1) sentences.push(`${soundEffects} sound effects in this project play it. They are removed with the file.`);
    if (asset.owner.kind === 'library') sentences.push(MediaBinPresenter.OTHER_PROJECTS_LOSE_IT);
    sentences.push("You can't undo this.");
    return sentences.join(' ');
  }

  private heldIn(usage: ReadonlyMap<string, MediaFileUsage>, mediaId: string): MediaFileUsage {
    return usage.get(mediaId) ?? { shots: 0, isMusic: false, soundEffects: 0 };
  }
}
