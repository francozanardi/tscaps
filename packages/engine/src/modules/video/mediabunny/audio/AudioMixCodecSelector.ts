import type { AudioCodec } from 'mediabunny';

/** The shape of the audio a mix is encoded as. */
export interface AudioMixEncodingShape {
  readonly numberOfChannels: number;
  readonly sampleRate: number;
}

/**
 * Picks the codec a mixed audio track is encoded with, among those the
 * output container can hold, or answers `null` when none of them can
 * be encoded here.
 */
export interface AudioMixCodecSelector {
  select(containerCodecs: ReadonlyArray<AudioCodec>, shape: AudioMixEncodingShape): Promise<AudioCodec | null>;
}
