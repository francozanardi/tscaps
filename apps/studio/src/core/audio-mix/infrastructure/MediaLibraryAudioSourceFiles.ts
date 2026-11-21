import type { AudioMixTelemetryReporter } from '@core/audio-mix/services/AudioMixTelemetryReporter';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';

/**
 * {@link AudioSourceFiles} that reads a media file as it was added —
 * audio has no proxy — and fetches a bundled sound from where the pack
 * serves it, then keeps only what this browser can decode, asked of the
 * same probe an import asks. A file that will not decode would otherwise
 * fail a whole export once its mix is decoded. A bundled sound this
 * build does not carry cannot be had.
 *
 * Reads and probes on every call; a caller asking for the same file
 * again keeps the first answer itself.
 */
export class MediaLibraryAudioSourceFiles implements AudioSourceFiles {
  constructor(
    private readonly bytes: MediaAssetBytesRepository,
    private readonly builtinSounds: BuiltinSoundCatalog,
    private readonly playback: AudioPlaybackProbe,
    private readonly telemetry: AudioMixTelemetryReporter,
  ) {}

  async load(source: AudioSourceRef): Promise<Blob | null> {
    const file = await this.read(source);
    if (file === null) return null;
    try {
      await this.playback.ensurePlayable(file);
      return file;
    } catch (refusal) {
      console.warn(`[audio-mix] ${this.describe(source)} cannot be decoded in this browser`, refusal);
      this.telemetry.sourceUnavailable(source, 'undecodable');
      return null;
    }
  }

  private async read(source: AudioSourceRef): Promise<Blob | null> {
    try {
      return source.kind === 'media'
        ? await this.bytes.load(source.mediaId, 'original')
        : await this.fetchBuiltin(source.soundId);
    } catch (error) {
      console.error(`[audio-mix] ${this.describe(source)} could not be read`, error);
      this.telemetry.sourceUnavailable(source, 'read-failed');
      return null;
    }
  }

  private async fetchBuiltin(soundId: string): Promise<Blob | null> {
    const sound = this.builtinSounds.find(soundId);
    if (sound === null) return null;
    const response = await fetch(sound.url);
    if (!response.ok) throw new Error(`Fetching ${sound.url} answered ${response.status}.`);
    return response.blob();
  }

  private describe(source: AudioSourceRef): string {
    return source.kind === 'media' ? `the audio file ${source.mediaId}` : `the bundled sound ${source.soundId}`;
  }
}
