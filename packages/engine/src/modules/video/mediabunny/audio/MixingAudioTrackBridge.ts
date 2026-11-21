import {
  AudioSample,
  AudioSampleSource,
  QUALITY_HIGH,
  type AudioCodec,
  type InputAudioTrack,
  type Output,
} from 'mediabunny';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { AudioLayerDecoder } from '@modules/video/mediabunny/audio/AudioLayerDecoder';
import { AudioLayerDecodeFailedError } from '@modules/video/mediabunny/audio/AudioLayerDecodeFailedError';
import { AudioLayerBed, type DecodedAudioLayer } from '@modules/video/mediabunny/audio/AudioLayerBed';
import type { DecodedAudioShape } from '@modules/video/mediabunny/audio/OutputTimeAudioTrackReader';
import { FallbackInputAudioReader } from '@modules/video/mediabunny/audio/FallbackInputAudioReader';
import type { AudioTrackSampleDecoder } from '@modules/audio-decoding/AudioTrackSampleDecoder';
import { AudioGainEnvelope } from '@modules/video/AudioGainEnvelope';
import type { RenderAudioMix } from '@modules/video/RenderJob';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';

export interface MixingAudioTrackBridgeConfig {
  /** The input's own audio, mixed under the layers; `null` writes the layers alone. */
  inputTrack: InputAudioTrack | null;
  /** The input file `inputTrack` belongs to. */
  inputSource: Blob;
  /** Decodes the input's audio where WebCodecs fails on it. */
  inputFallbackDecoder: AudioTrackSampleDecoder;
  /** Called once, with the WebCodecs error, when the input's audio moves to the fallback decoder. */
  onInputAudioFallback?: (cause: unknown) => void;
  mix: RenderAudioMix;
  /** Target codec. Must be encodable here and held by the output container. */
  codec: AudioCodec;
  timeMap: RenderTimeMap;
  /** Length of the output; the written track is exactly this long. */
  outputDurationSec: number;
  decoder: AudioLayerDecoder;
  /**
   * Asked, with their ids, whether to write the mix without the layers
   * whose source cannot be decoded; absent, or answered `false`, the
   * bridge rejects instead.
   */
  confirmUndecodableLayers?: (layerIds: ReadonlyArray<string>) => Promise<boolean>;
}

/**
 * Writes the input's audio and a set of audio layers, summed, as one
 * encoded track.
 *
 * The input's audio is decoded and laid on output time with the skipped
 * windows cut out to the sample (see {@link FallbackInputAudioReader}:
 * through WebCodecs, and through the fallback decoder where WebCodecs
 * fails on it),
 * scaled by the mix's input gain and shaped over its input ducks'
 * ranges. The layers are rendered over it (see
 * {@link AudioLayerBed}); peaks past full scale are clipped. The track
 * runs at the rate the input's audio decodes to, with at most two
 * channels; without input audio, at 48 kHz stereo. It is written in
 * windows of a couple of seconds, a window at a time ahead of the video.
 *
 * Every layer's source is decoded once, in {@link attachTo}, before
 * anything is written. Where some cannot be decoded, the config's
 * `confirmUndecodableLayers` is asked once, with every layer using one;
 * agreeing writes the mix without them, and otherwise {@link attachTo}
 * rejects with an {@link AudioLayerDecodeFailedError} naming the first.
 * Where the input's audio cannot be decoded by either path, the call
 * that reached it rejects with an `InputAudioDecodeFailedError`:
 * {@link attachTo}, before anything is written, or a later one.
 */
export class MixingAudioTrackBridge implements AudioTrackBridge {

  private static readonly WINDOW_SEC = 2;
  /** The most channels the track is written with. */
  static readonly MAX_CHANNELS = 2;
  /** The track's shape when no input audio is mixed in. */
  static readonly SHAPE_WITHOUT_INPUT: DecodedAudioShape = { sampleRate: 48_000, numberOfChannels: 2 };

  private readonly source: AudioSampleSource;
  private reader: FallbackInputAudioReader | null = null;
  private bed: AudioLayerBed | null = null;
  private shape: DecodedAudioShape = MixingAudioTrackBridge.SHAPE_WITHOUT_INPUT;
  private totalFrames = 0;
  private nextFrame = 0;

  constructor(private readonly config: MixingAudioTrackBridgeConfig) {
    this.source = new AudioSampleSource({ codec: config.codec, bitrate: QUALITY_HIGH });
  }

  async attachTo(output: Output): Promise<void> {
    try {
      this.shape = await this.openInput();
      this.bed = new AudioLayerBed(
        await this.decodeLayers(this.shape.sampleRate),
        this.shape.sampleRate,
        this.shape.numberOfChannels,
        this.config.outputDurationSec,
      );
    } catch (error) {
      await this.reader?.close();
      throw error;
    }
    this.totalFrames = Math.max(0, Math.round(this.config.outputDurationSec * this.shape.sampleRate));
    output.addAudioTrack(this.source);
  }

  async pumpUntil(videoTimestamp: number): Promise<void> {
    const targetFrame = Math.round(this.config.timeMap.toOutputTime(videoTimestamp) * this.shape.sampleRate);
    while (this.nextFrame <= targetFrame && this.nextFrame < this.totalFrames) await this.writeWindow();
  }

  async finish(): Promise<void> {
    try {
      while (this.nextFrame < this.totalFrames) await this.writeWindow();
    } finally {
      await this.reader?.close();
    }
  }

  /** Starts reading the input's audio when it is heard, and answers the shape of the track to write. */
  private async openInput(): Promise<DecodedAudioShape> {
    const track = this.config.inputTrack;
    if (!track) return MixingAudioTrackBridge.SHAPE_WITHOUT_INPUT;
    if (this.config.mix.inputGain <= 0) {
      return {
        sampleRate: track.sampleRate,
        numberOfChannels: Math.min(track.numberOfChannels, MixingAudioTrackBridge.MAX_CHANNELS),
      };
    }
    this.reader = new FallbackInputAudioReader({
      track,
      source: this.config.inputSource,
      fallbackDecoder: this.config.inputFallbackDecoder,
      timeMap: this.config.timeMap,
      gain: AudioGainEnvelope.forInput(this.config.mix.inputGain, this.config.mix.inputDucks ?? [], this.config.outputDurationSec),
      maxChannels: MixingAudioTrackBridge.MAX_CHANNELS,
      ...(this.config.onInputAudioFallback ? { onFallback: this.config.onInputAudioFallback } : {}),
    });
    return this.reader.open();
  }

  /** Decodes each distinct source once, for every layer that uses it, leaving out the undecodable ones where allowed. */
  private async decodeLayers(sampleRate: number): Promise<DecodedAudioLayer[]> {
    const decodedBySource = new Map<Blob, Promise<AudioBuffer>>();
    const decoded: DecodedAudioLayer[] = [];
    const failed: Array<{ readonly layerId: string; readonly cause: unknown }> = [];
    for (const layer of this.config.mix.layers) {
      let audio = decodedBySource.get(layer.source);
      if (!audio) {
        audio = this.config.decoder.decode(layer.source, sampleRate);
        decodedBySource.set(layer.source, audio);
      }
      try {
        decoded.push({ layer, audio: await audio });
      } catch (cause) {
        failed.push({ layerId: layer.id, cause });
      }
    }
    const first = failed[0];
    if (first === undefined) return decoded;
    const goOn = await this.config.confirmUndecodableLayers?.(failed.map(({ layerId }) => layerId)) ?? false;
    if (!goOn) throw new AudioLayerDecodeFailedError(first.layerId, { cause: first.cause });
    return decoded;
  }

  private async writeWindow(): Promise<void> {
    const { sampleRate, numberOfChannels } = this.shape;
    const frames = Math.min(Math.round(MixingAudioTrackBridge.WINDOW_SEC * sampleRate), this.totalFrames - this.nextFrame);
    const channels: Float32Array[] = [];
    for (let channel = 0; channel < numberOfChannels; channel++) channels.push(new Float32Array(frames));
    await this.reader?.addInto(channels, this.nextFrame);
    this.bed?.addInto(channels, this.nextFrame);
    const sample = new AudioSample({
      data: this.clippedPlanar(channels),
      format: 'f32-planar',
      numberOfChannels,
      sampleRate,
      timestamp: this.nextFrame / sampleRate,
    });
    try {
      await this.source.add(sample);
    } finally {
      sample.close();
    }
    this.nextFrame += frames;
  }

  /** The channels one after another, each value clipped to full scale. */
  private clippedPlanar(channels: ReadonlyArray<Float32Array>): Float32Array {
    const frames = channels[0]?.length ?? 0;
    const planar = new Float32Array(frames * channels.length);
    for (const [channel, data] of channels.entries()) {
      const offset = channel * frames;
      for (let index = 0; index < frames; index++) planar[offset + index] = Math.max(-1, Math.min(1, data[index]!));
    }
    return planar;
  }
}
