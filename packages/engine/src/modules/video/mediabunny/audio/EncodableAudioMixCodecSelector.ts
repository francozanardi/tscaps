import { NON_PCM_AUDIO_CODECS, getFirstEncodableAudioCodec, type AudioCodec } from 'mediabunny';
import type {
  AudioMixCodecSelector,
  AudioMixEncodingShape,
} from '@modules/video/mediabunny/audio/AudioMixCodecSelector';

/**
 * {@link AudioMixCodecSelector} that answers the first compressed codec,
 * in the container's order of preference, that the browser encodes or
 * an encoder registered with mediabunny's `registerEncoder` accepts.
 * For MP4 that is AAC, then Opus, then the rest; for WebM, Opus first.
 *
 * Uncompressed PCM is never picked: mediabunny can always write it, but
 * most players refuse it inside MP4 and WebM.
 */
export class EncodableAudioMixCodecSelector implements AudioMixCodecSelector {

  async select(containerCodecs: ReadonlyArray<AudioCodec>, shape: AudioMixEncodingShape): Promise<AudioCodec | null> {
    const compressedCodecs: ReadonlyArray<AudioCodec> = NON_PCM_AUDIO_CODECS;
    const compressed = containerCodecs.filter((codec) => compressedCodecs.includes(codec));
    return getFirstEncodableAudioCodec(compressed, {
      numberOfChannels: shape.numberOfChannels,
      sampleRate: shape.sampleRate,
    });
  }
}
