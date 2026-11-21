import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';

/** What the file a clip plays is called, wherever a sound is listed. */
export class SoundNames {
  constructor(private readonly builtinSounds: BuiltinSoundCatalog) {}

  /** A bundled sound's name, or the user's file's name; a file the project no longer holds says so. */
  nameOf(source: AudioSourceRef, media: MediaAssetCatalog): string {
    if (source.kind === 'builtin') return this.builtinSounds.find(source.soundId)?.name ?? 'Unknown sound';
    const file = media.get(source.mediaId);
    if (file === null) return 'Missing file';
    return file.fileName.trim() === '' ? 'Untitled file' : file.fileName;
  }
}
