import type { AudioSourceLengths } from '@core/audio-mix/domain/AudioSourceLengths';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';

/**
 * {@link AudioSourceLengths} that reads a media file's length off the
 * media catalog, as its import measured it, and a bundled sound's off
 * the pack's catalog. Holds the media catalog it was given: a changed
 * catalog is a new instance.
 */
export class CatalogAudioSourceLengths implements AudioSourceLengths {
  constructor(
    private readonly media: MediaAssetCatalog,
    private readonly builtinSounds: BuiltinSoundCatalog,
  ) {}

  lengthOf(source: AudioSourceRef): number | null {
    const length = source.kind === 'builtin'
      ? this.builtinSounds.find(source.soundId)?.lengthSec ?? null
      : this.media.get(source.mediaId)?.durationSec ?? null;
    return length !== null && length > 0 ? length : null;
  }
}
