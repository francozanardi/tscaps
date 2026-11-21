import { ALL_FORMATS, BlobSource, Input, type InputAudioTrack } from 'mediabunny';
import type { AudioLayerDecoder } from '@tscaps/engine/advanced';
import type { PreviewAudioSource } from '@core/preview/domain/PreviewAudioSource';
import type { PreviewAudioSourceOpener } from '@core/preview/domain/PreviewAudioSourceOpener';
import { DecodedPreviewAudioSource } from '@core/preview/infrastructure/audio/DecodedPreviewAudioSource';
import { MediaBunnyStreamedPreviewAudioSource } from '@core/preview/infrastructure/mediabunny/MediaBunnyStreamedPreviewAudioSource';

/**
 * {@link PreviewAudioSourceOpener} that streams a long file and decodes
 * a short one whole.
 *
 * A file longer than `streamLongerThanSec` that WebCodecs can decode is
 * decoded as it plays, so a song costs memory for the stretch being
 * heard rather than for all of it. Anything else — a short sound,
 * started at once without waiting on a decoder, or a file only
 * `wholeDecoder` can read — is decoded whole at the rate asked, by the
 * decoder the export uses.
 */
export class MediaBunnyPreviewAudioSourceOpener implements PreviewAudioSourceOpener {
  constructor(
    private readonly wholeDecoder: AudioLayerDecoder,
    private readonly streamLongerThanSec: number,
  ) {}

  async open(file: Blob, sampleRate: number): Promise<PreviewAudioSource> {
    const streamed = await this.streamedOrNull(file);
    if (streamed !== null) return streamed;
    return new DecodedPreviewAudioSource(await this.wholeDecoder.decode(file, sampleRate));
  }

  /** The file streamed, or null when it is short or WebCodecs cannot read it. */
  private async streamedOrNull(file: Blob): Promise<PreviewAudioSource | null> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      const track = await this.decodableTrackOf(input);
      const durationSec = track === null ? 0 : await track.computeDuration();
      if (track !== null && durationSec > this.streamLongerThanSec) {
        return new MediaBunnyStreamedPreviewAudioSource(input, track, durationSec);
      }
    } catch {
      // A file mediabunny cannot open is the whole decoder's to try, which reports its own failure.
    }
    input.dispose();
    return null;
  }

  private async decodableTrackOf(input: Input): Promise<InputAudioTrack | null> {
    const track = await input.getPrimaryAudioTrack();
    return track !== null && (await track.canDecode()) ? track : null;
  }
}
