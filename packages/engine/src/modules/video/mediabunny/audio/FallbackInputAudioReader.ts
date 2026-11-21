import { AudioSampleSink, type AudioSample, type InputAudioTrack } from 'mediabunny';
import type { AudioTrackSampleDecoder } from '@modules/audio-decoding/AudioTrackSampleDecoder';
import {
  OutputTimeAudioTrackReader,
  type DecodedAudioShape,
} from '@modules/video/mediabunny/audio/OutputTimeAudioTrackReader';
import { InputAudioDecodeFailedError } from '@modules/video/mediabunny/audio/InputAudioDecodeFailedError';
import type { AudioGainEnvelope } from '@modules/video/AudioGainEnvelope';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';

export interface FallbackInputAudioReaderConfig {
  /** The input's audio track, decoded through WebCodecs first. */
  track: InputAudioTrack;
  /** The input file itself, which the fallback decoder reads the track from again. */
  source: Blob;
  /** Decodes the track when WebCodecs fails on it. */
  fallbackDecoder: AudioTrackSampleDecoder;
  timeMap: RenderTimeMap;
  gain: AudioGainEnvelope;
  maxChannels: number;
  /** Called once, with the WebCodecs error, when the reading moves to the fallback decoder. */
  onFallback?: (cause: unknown) => void;
}

/**
 * Reads the input's audio in output time, like
 * {@link OutputTimeAudioTrackReader}, through WebCodecs and, when
 * WebCodecs fails on the track, through a fallback decoder — whether
 * the failure comes on the first sample or partway through.
 *
 * The fallback reads from the track's start again and goes on from the
 * window that failed, at the rate already in use, so the output does
 * not change shape. A browser can say it decodes a codec and then fail
 * on it; this is what keeps the voice in the mix there.
 *
 * Rejects with {@link InputAudioDecodeFailedError} when the fallback
 * fails too, or when it decodes to another channel count than WebCodecs
 * did partway through.
 */
export class FallbackInputAudioReader {

  private reader: OutputTimeAudioTrackReader;
  private webCodecsError: unknown = null;
  private shape: DecodedAudioShape | null = null;

  constructor(private readonly config: FallbackInputAudioReaderConfig) {
    this.reader = this.readerOf(new AudioSampleSink(config.track).samples());
  }

  /** Decodes the first stretch of the track and answers the shape the reader writes. */
  async open(): Promise<DecodedAudioShape> {
    try {
      this.shape = await this.reader.open();
    } catch (error) {
      this.shape = await this.openFallback(error, this.config.track.sampleRate);
    }
    return this.shape;
  }

  /**
   * Adds the track's frames `[startFrame, startFrame + target[0].length)`
   * into `target`, one array per channel. A window must not start before
   * the end of the previous one.
   */
  async addInto(target: ReadonlyArray<Float32Array>, startFrame: number): Promise<void> {
    try {
      await this.reader.addInto(target, startFrame);
    } catch (error) {
      if (this.webCodecsError !== null) throw this.bothFailed(error);
      await this.continueWithFallback(error);
      await this.readFallback(() => this.reader.addInto(target, startFrame));
    }
  }

  /** Stops decoding. Idempotent. */
  async close(): Promise<void> {
    await this.reader.close();
  }

  private async openFallback(webCodecsError: unknown, sampleRate: number): Promise<DecodedAudioShape> {
    await this.switchToFallback(webCodecsError, sampleRate);
    return this.readFallback(() => this.reader.open());
  }

  /** Moves to the fallback after the first windows were read through WebCodecs, keeping the shape in use. */
  private async continueWithFallback(webCodecsError: unknown): Promise<void> {
    const shape = this.shape!;
    const fallbackShape = await this.openFallback(webCodecsError, shape.sampleRate);
    if (fallbackShape.numberOfChannels !== shape.numberOfChannels) {
      throw new InputAudioDecodeFailedError(
        `The input audio decoded to ${fallbackShape.numberOfChannels} channels after falling back`
        + ` from WebCodecs at ${shape.numberOfChannels}. WebCodecs: ${this.describe(webCodecsError)}`,
        { cause: webCodecsError },
      );
    }
  }

  private async switchToFallback(webCodecsError: unknown, sampleRate: number): Promise<void> {
    this.webCodecsError = webCodecsError;
    this.config.onFallback?.(webCodecsError);
    await this.reader.close();
    this.reader = this.readerOf(this.config.fallbackDecoder.samples(this.config.source, sampleRate));
  }

  private async readFallback<Result>(read: () => Promise<Result>): Promise<Result> {
    try {
      return await read();
    } catch (error) {
      throw this.bothFailed(error);
    }
  }

  private bothFailed(fallbackError: unknown): InputAudioDecodeFailedError {
    return new InputAudioDecodeFailedError(
      `The input audio could not be decoded. WebCodecs: ${this.describe(this.webCodecsError)}.`
      + ` Fallback: ${this.describe(fallbackError)}`,
      { cause: fallbackError },
    );
  }

  private readerOf(samples: AsyncIterable<AudioSample>): OutputTimeAudioTrackReader {
    return new OutputTimeAudioTrackReader(samples, this.config.timeMap, this.config.gain, this.config.maxChannels);
  }

  private describe(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  }
}
