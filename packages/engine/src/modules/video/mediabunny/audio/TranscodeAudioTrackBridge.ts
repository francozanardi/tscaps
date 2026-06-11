import {
  AudioSampleSink,
  AudioSampleSource,
  QUALITY_HIGH,
  type AudioCodec,
  type AudioSample,
  type InputAudioTrack,
  type Output,
} from 'mediabunny';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';

export interface TranscodeAudioTrackBridgeConfig {
  inputTrack: InputAudioTrack;
  /** Target codec to encode into. Must be supported by the output container. */
  codec: AudioCodec;
}

/**
 * Decodes the input audio track and re-encodes it into the requested
 * target codec on the fly. Used when the input's codec cannot be copied
 * into the chosen output container as-is.
 */
export class TranscodeAudioTrackBridge implements AudioTrackBridge {

  private readonly source: AudioSampleSource;
  private readonly sink: AudioSampleSink;
  private iterator: AsyncIterator<AudioSample> | null = null;
  private nextSample: AudioSample | null = null;

  constructor(config: TranscodeAudioTrackBridgeConfig) {
    this.source = new AudioSampleSource({ codec: config.codec, bitrate: QUALITY_HIGH });
    this.sink = new AudioSampleSink(config.inputTrack);
  }

  async attachTo(output: Output): Promise<void> {
    output.addAudioTrack(this.source);
    this.iterator = this.sink.samples()[Symbol.asyncIterator]();
    this.nextSample = await this.advance();
  }

  async pumpUntil(videoTimestamp: number): Promise<void> {
    while (this.nextSample && this.nextSample.timestamp <= videoTimestamp) {
      await this.emit(this.nextSample);
      this.nextSample = await this.advance();
    }
  }

  async finish(): Promise<void> {
    while (this.nextSample) {
      await this.emit(this.nextSample);
      this.nextSample = await this.advance();
    }
  }

  private async emit(sample: AudioSample): Promise<void> {
    try {
      // Samples before t=0 (container offsets) are discarded because the
      // muxer rejects negative timestamps.
      if (sample.timestamp >= 0) {
        await this.source.add(sample);
      }
    } finally {
      sample.close();
    }
  }

  private async advance(): Promise<AudioSample | null> {
    if (!this.iterator) return null;
    const { value, done } = await this.iterator.next();
    return done || !value ? null : value;
  }
}
