import type { AudioSampleSink } from 'mediabunny';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';
import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';
import { MediaBunnyAudioFrame } from '@core/preview/infrastructure/mediabunny/MediaBunnyAudioFrame';

/**
 * Adapter that exposes a mediabunny {@link AudioSampleSink} through
 * the domain-shaped {@link PreviewAudioTrack} port, wrapping every
 * yielded sample as a {@link MediaBunnyAudioFrame} so vendor types
 * never leak out.
 */
export class MediaBunnyAudioTrack implements PreviewAudioTrack {

  constructor(private readonly sink: AudioSampleSink) {}

  async *streamFrames(startSourceSec: number): AsyncIterable<PreviewAudioFrame> {
    for await (const sample of this.sink.samples(startSourceSec)) {
      yield new MediaBunnyAudioFrame(sample);
    }
  }
}
