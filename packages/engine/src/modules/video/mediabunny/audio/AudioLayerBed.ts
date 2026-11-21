import type { AudioLayer } from '@modules/video/AudioLayer';
import { AudioGainEnvelope } from '@modules/video/AudioGainEnvelope';
import { AudioChannelMap } from '@modules/video/mediabunny/audio/AudioChannelMap';

/** A layer with its source decoded at the bed's rate. */
export interface DecodedAudioLayer {
  readonly layer: AudioLayer;
  readonly audio: AudioBuffer;
}

/** A layer as the bed plays it: in frames of the bed's rate, with its gain curve. */
interface PlacedAudioLayer {
  readonly audio: AudioBuffer;
  readonly envelope: AudioGainEnvelope;
  readonly channelMap: AudioChannelMap;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly sourceStartFrame: number;
  /** Frames per pass, unrounded so that many passes do not drift; `Infinity` plays once. */
  readonly passFrames: number;
}

/**
 * The sum of a set of audio layers over output time, rendered into any
 * window of frames on request.
 *
 * Every layer is placed to the frame: its first source frame lands on
 * the frame nearest its start, and each later frame follows one for
 * one, so a window boundary falls between two frames of a layer exactly
 * as it would anywhere else. Each frame is scaled by the layer's
 * {@link AudioGainEnvelope} sampled at that frame.
 */
export class AudioLayerBed {

  private readonly layers: ReadonlyArray<PlacedAudioLayer>;

  /**
   * @param layers - Sources decoded at `sampleRate`.
   * @param outputDurationSec - Where every layer stops at the latest.
   */
  constructor(
    layers: ReadonlyArray<DecodedAudioLayer>,
    private readonly sampleRate: number,
    numberOfChannels: number,
    outputDurationSec: number,
  ) {
    this.layers = layers
      .map((decoded) => this.place(decoded, numberOfChannels, outputDurationSec))
      .filter((placed) => placed.endFrame > placed.startFrame);
  }

  /**
   * Adds the bed's frames `[startFrame, startFrame + target[0].length)`
   * into `target`, one array per channel.
   */
  addInto(target: ReadonlyArray<Float32Array>, startFrame: number): void {
    const endFrame = startFrame + (target[0]?.length ?? 0);
    for (const layer of this.layers) {
      const from = Math.max(startFrame, layer.startFrame, 0);
      const to = Math.min(endFrame, layer.endFrame);
      if (to <= from) continue;
      this.addLayer(layer, target, startFrame, from, to);
    }
  }

  private place(decoded: DecodedAudioLayer, numberOfChannels: number, outputDurationSec: number): PlacedAudioLayer {
    const { layer, audio } = decoded;
    const envelope = new AudioGainEnvelope(layer, { outputDurationSec, sourceDurationSec: audio.length / this.sampleRate });
    return {
      audio,
      envelope,
      channelMap: new AudioChannelMap(audio.numberOfChannels, numberOfChannels),
      startFrame: this.frameOf(envelope.startSec),
      endFrame: this.frameOf(envelope.endSec),
      sourceStartFrame: this.frameOf(layer.sourceStartSec),
      passFrames: layer.sourcePassSec > 0 ? layer.sourcePassSec * this.sampleRate : Number.POSITIVE_INFINITY,
    };
  }

  private addLayer(
    layer: PlacedAudioLayer,
    target: ReadonlyArray<Float32Array>,
    windowStart: number,
    from: number,
    to: number,
  ): void {
    const gains = new Float32Array(to - from);
    layer.envelope.sampleInto(gains, from, this.sampleRate);
    const sourceFrames = this.sourceFramesOf(layer, from, to);
    for (const [channel, out] of target.entries()) {
      const weight = layer.channelMap.weightOf(channel);
      for (const source of layer.channelMap.sourcesOf(channel)) {
        const data = layer.audio.getChannelData(source);
        for (let index = 0; index < gains.length; index++) {
          const sourceFrame = sourceFrames[index]!;
          if (sourceFrame < 0) continue;
          out[from - windowStart + index]! += data[sourceFrame]! * gains[index]! * weight;
        }
      }
    }
  }

  /** The source frame heard at each output frame of `[from, to)`; -1 where a pass has run past the source. */
  private sourceFramesOf(layer: PlacedAudioLayer, from: number, to: number): Int32Array {
    const frames = new Int32Array(to - from);
    for (let index = 0; index < frames.length; index++) {
      const intoLayer = from + index - layer.startFrame;
      const intoPass = Number.isFinite(layer.passFrames)
        ? intoLayer - Math.round(Math.floor((intoLayer + 0.5) / layer.passFrames) * layer.passFrames)
        : intoLayer;
      const sourceFrame = layer.sourceStartFrame + intoPass;
      frames[index] = intoPass >= 0 && sourceFrame < layer.audio.length ? sourceFrame : -1;
    }
    return frames;
  }

  private frameOf(timeSec: number): number {
    return Math.round(timeSec * this.sampleRate);
  }
}
