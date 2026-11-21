import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  type AudioCodec,
} from 'mediabunny';
import { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
import { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
import { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
import { ProbingVideoEncoderAccelerationPolicy } from '@modules/video/mediabunny/encoder/ProbingVideoEncoderAccelerationPolicy';
import { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
import { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
import { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
import { EncodableAudioMixCodecSelector } from '@modules/video/mediabunny/audio/EncodableAudioMixCodecSelector';
import { FallbackAudioLayerDecoder } from '@modules/video/mediabunny/audio/FallbackAudioLayerDecoder';
import { MediaBunnyAudioLayerDecoder } from '@modules/video/mediabunny/audio/MediaBunnyAudioLayerDecoder';
import { WebAudioAudioLayerDecoder } from '@modules/video/mediabunny/audio/WebAudioAudioLayerDecoder';
import { AudioLayerDecodeFailedError } from '@modules/video/mediabunny/audio/AudioLayerDecodeFailedError';
import { WebAudioAudioTrackSampleDecoder } from '@modules/audio-decoding/WebAudioAudioTrackSampleDecoder';
import type { AudioLayerDecoder } from '@modules/video/mediabunny/audio/AudioLayerDecoder';
import type { AudioMixCodecSelector } from '@modules/video/mediabunny/audio/AudioMixCodecSelector';
import type { RenderAudioMix } from '@modules/video/RenderJob';
import { RenderTimeMap, type TimeRange } from '@modules/video/RenderTimeMap';

/** A video to render from: blank frames, and optionally a PCM audio track of the given samples. */
export interface FixtureSourceSpec {
  readonly durationSec: number;
  readonly fps: number;
  readonly audio?: {
    readonly sampleRate: number;
    /** One array per channel, each as long as the track. */
    readonly channels: ReadonlyArray<Float32Array>;
    readonly codec: 'pcm-f32' | 'pcm-s16';
  };
}

/** How the layers' sources are decoded in a fixture render. */
export type FixtureLayerDecoding = 'default' | 'primary-fails' | 'all-fail';

/**
 * How the browser decodes the input's own audio in a fixture render:
 * as it does, or with WebCodecs failing on every packet, failing past
 * the first packets, or failing with the Web Audio API failing too —
 * while WebCodecs still says it supports the codec, as some browsers do.
 */
export type FixtureInputAudioDecoding = 'default' | 'webcodecs-fails' | 'webcodecs-fails-partway' | 'all-fail';

export interface FixtureRenderRequest {
  readonly source: Blob;
  readonly mix?: RenderAudioMix;
  readonly skipRanges?: ReadonlyArray<TimeRange>;
  readonly audio?: 'keep' | 'discard';
  readonly outputFormat?: 'mp4' | 'webm';
  /** A codec the mix is forced into; the encodable selector picks when absent, and `null` forces none. */
  readonly mixCodec?: AudioCodec | null;
  readonly layerDecoding?: FixtureLayerDecoding;
  readonly inputAudioDecoding?: FixtureInputAudioDecoding;
  /** How the render answers when asked to go on without undecodable layers; not asked when absent. */
  readonly undecodableLayers?: 'go-on' | 'stop';
}

export interface FixtureRenderResult {
  readonly blob: Blob | null;
  readonly errorName: string | null;
  readonly failedLayerId: string | null;
  readonly mixDropped: ReadonlyArray<string>;
  readonly audioDiscarded: ReadonlyArray<string>;
  /** How many times each layer source was decoded, in the order sources were first met. */
  readonly decodesPerSource: ReadonlyArray<number>;
  /** The layer ids the render was asked to go on without, in the one ask; empty when it was not asked. */
  readonly askedToGoOnWithout: ReadonlyArray<string>;
  /** The names of the WebCodecs errors the input's audio fell back from. */
  readonly inputAudioFallbacks: ReadonlyArray<string>;
}

/** An output's audio track, decoded. */
export interface FixtureDecodedAudio {
  readonly codec: string | null;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  /** The first decoded sample's timestamp. */
  readonly firstTimestampSec: number;
  readonly channels: Float32Array[];
}

/**
 * Builds sources and runs renders with audio mixes inside a test page,
 * through the same coordinator and bridge factory an export uses, with
 * a painter that draws nothing.
 */
export class AudioMixRenderFixture {

  /** Short, so that the 1 s fixture source is decoded across several segment seams. */
  private static readonly FALLBACK_SEGMENT_SEC = 0.25;
  /** How many of the input's audio packets WebCodecs decodes before failing, partway. */
  private static readonly PACKETS_BEFORE_FAILING = 20;

  async sourceVideo(spec: FixtureSourceSpec): Promise<File> {
    const canvas = new OffscreenCanvas(64, 64);
    const context = canvas.getContext('2d')!;
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const video = new CanvasSource(canvas, { codec: 'avc', bitrate: 200_000, keyFrameInterval: 1 });
    output.addVideoTrack(video);
    const audio = spec.audio ? new AudioSampleSource({ codec: spec.audio.codec, bitrate: 128_000 }) : null;
    if (audio) output.addAudioTrack(audio);
    await output.start();
    if (spec.audio && audio) await this.addAudio(audio, spec.audio.channels, spec.audio.sampleRate);
    const frames = Math.round(spec.durationSec * spec.fps);
    for (let frame = 0; frame < frames; frame++) {
      context.fillStyle = frame % 2 === 0 ? '#204080' : '#802040';
      context.fillRect(0, 0, 64, 64);
      await video.add(frame / spec.fps, 1 / spec.fps);
    }
    await output.finalize();
    return new File([target.buffer!], 'source.mp4', { type: 'video/mp4' });
  }

  /** A 32-bit float WAV of the given channels. */
  wav(channels: ReadonlyArray<Float32Array>, sampleRate: number): Blob {
    const frames = channels[0]?.length ?? 0;
    const bytes = new DataView(new ArrayBuffer(44 + frames * channels.length * 4));
    const text = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index++) bytes.setUint8(offset + index, value.charCodeAt(index));
    };
    text(0, 'RIFF');
    bytes.setUint32(4, 36 + frames * channels.length * 4, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 3, true);
    bytes.setUint16(22, channels.length, true);
    bytes.setUint32(24, sampleRate, true);
    bytes.setUint32(28, sampleRate * channels.length * 4, true);
    bytes.setUint16(32, channels.length * 4, true);
    bytes.setUint16(34, 32, true);
    text(36, 'data');
    bytes.setUint32(40, frames * channels.length * 4, true);
    for (let frame = 0; frame < frames; frame++) {
      for (const [channel, data] of channels.entries()) {
        bytes.setFloat32(44 + (frame * channels.length + channel) * 4, data[frame]!, true);
      }
    }
    return new Blob([bytes.buffer], { type: 'audio/wav' });
  }

  async render(request: FixtureRenderRequest): Promise<FixtureRenderResult> {
    const mixDropped: string[] = [];
    const audioDiscarded: string[] = [];
    const askedToGoOnWithout: string[] = [];
    const inputAudioFallbacks: string[] = [];
    const restoreDecoding = this.breakInputAudioDecoding(request.inputAudioDecoding ?? 'default');
    const decodes = new Map<Blob, number>();
    const coordinator = new MediaBunnyTranscodeCoordinator({
      videoFrameDecoderFactory: new DefaultVideoFrameDecoderFactory(),
      videoTrackEncoderFactory: new MediaBunnyCanvasVideoTrackEncoderFactory(),
      videoEncoderAccelerationPolicy: new ProbingVideoEncoderAccelerationPolicy(),
      audioTrackBridgeFactory: new DefaultAudioTrackBridgeFactory(
        this.countingDecoder(this.layerDecoder(request.layerDecoding ?? 'default'), decodes),
        this.codecSelector(request.mixCodec),
        new WebAudioAudioTrackSampleDecoder(AudioMixRenderFixture.FALLBACK_SEGMENT_SEC),
      ),
      outputTargetBuilder: new MediaBunnyOutputTargetBuilder(),
    });
    try {
      const result = await coordinator.execute({
        source: new File([request.source], 'source.mp4'),
        codecPolicy: new DefaultCodecPolicy(),
        painter: {
          begin: async () => {},
          lookAhead: () => 1,
          paint: async (requests) => requests.map(() => () => {}),
          end: () => {},
        },
        sourcePixels: false,
        timeMap: new RenderTimeMap(request.skipRanges ?? []),
        ...(request.mix ? { audioMix: request.mix } : {}),
        ...(request.audio ? { audio: request.audio } : {}),
        ...(request.outputFormat ? { outputFormat: request.outputFormat } : {}),
        onAudioMixDropped: (reason) => { mixDropped.push(reason); },
        onAudioDiscarded: (reason) => { audioDiscarded.push(reason); },
        onAudioMixInputFallback: (cause) => { inputAudioFallbacks.push(cause instanceof Error ? cause.name : String(cause)); },
        ...(request.undecodableLayers ? {
          confirmUndecodableAudioLayers: async (layerIds: ReadonlyArray<string>) => {
            askedToGoOnWithout.push(...layerIds);
            return request.undecodableLayers === 'go-on';
          },
        } : {}),
      });
      return {
        blob: result.blob, errorName: null, failedLayerId: null, mixDropped, audioDiscarded, decodesPerSource: [...decodes.values()], askedToGoOnWithout, inputAudioFallbacks,
      };
    } catch (error) {
      return {
        blob: null,
        errorName: error instanceof Error ? error.name : String(error),
        failedLayerId: error instanceof AudioLayerDecodeFailedError ? error.layerId : null,
        mixDropped,
        audioDiscarded,
        decodesPerSource: [...decodes.values()],
        askedToGoOnWithout,
        inputAudioFallbacks,
      };
    } finally {
      restoreDecoding();
    }
  }

  /** The primary audio track of `file`, decoded whole; `null` when it has none. */
  async audioOf(file: Blob): Promise<FixtureDecodedAudio | null> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return null;
      const pieces: Float32Array[][] = [];
      let firstTimestampSec = Number.NaN;
      let sampleRate = track.sampleRate;
      let numberOfChannels = track.numberOfChannels;
      for await (const sample of new AudioSampleSink(track).samples()) {
        if (Number.isNaN(firstTimestampSec)) firstTimestampSec = sample.timestamp;
        sampleRate = sample.sampleRate;
        numberOfChannels = sample.numberOfChannels;
        pieces.push(this.planesOf(sample));
        sample.close();
      }
      return {
        codec: await track.getCodec(),
        sampleRate,
        numberOfChannels,
        firstTimestampSec,
        channels: this.joined(pieces, numberOfChannels),
      };
    } finally {
      input.dispose();
    }
  }

  /** The codec of `file`'s primary audio track, read from the container; `null` when it has none. */
  async audioCodecOf(file: Blob): Promise<string | null> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      return (await (await input.getPrimaryAudioTrack())?.getCodec()) ?? null;
    } finally {
      input.dispose();
    }
  }

  /** Every encoded audio packet of `file`, with its timing, as one string to compare. */
  async audioPacketsOf(file: Blob): Promise<string | null> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return null;
      const sink = new EncodedPacketSink(track);
      const parts: string[] = [];
      for (let packet = await sink.getFirstPacket(); packet; packet = await sink.getNextPacket(packet)) {
        parts.push(`${packet.timestamp}:${packet.duration}:${Array.from(packet.data).join(',')}`);
      }
      return parts.join('|');
    } finally {
      input.dispose();
    }
  }

  /** The output's video length, from its last frame's end. */
  async videoDurationOf(file: Blob): Promise<number> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      return await (await input.getPrimaryVideoTrack())!.computeDuration();
    } finally {
      input.dispose();
    }
  }

  private async addAudio(source: AudioSampleSource, channels: ReadonlyArray<Float32Array>, sampleRate: number): Promise<void> {
    const frames = channels[0]?.length ?? 0;
    const chunk = sampleRate;
    for (let start = 0; start < frames; start += chunk) {
      const length = Math.min(chunk, frames - start);
      const data = new Float32Array(length * channels.length);
      for (const [channel, plane] of channels.entries()) data.set(plane.subarray(start, start + length), channel * length);
      const sample = new AudioSample({
        data,
        format: 'f32-planar',
        numberOfChannels: channels.length,
        sampleRate,
        timestamp: start / sampleRate,
      });
      await source.add(sample);
      sample.close();
    }
  }

  /**
   * Makes the page's WebCodecs fail on audio the way a browser that
   * claims a codec it cannot decode does — a real decoder fed bytes it
   * rejects — and its Web Audio API reject too where asked. Answers
   * what puts the page back.
   */
  private breakInputAudioDecoding(decoding: FixtureInputAudioDecoding): () => void {
    if (decoding === 'default') return () => {};
    const page = globalThis as unknown as { AudioDecoder: typeof AudioDecoder };
    const RealAudioDecoder = page.AudioDecoder;
    const goodPackets = decoding === 'webcodecs-fails-partway' ? AudioMixRenderFixture.PACKETS_BEFORE_FAILING : 0;
    page.AudioDecoder = class FailingAudioDecoder extends RealAudioDecoder {
      private decodedPackets = 0;
      override decode(chunk: EncodedAudioChunk): void {
        if (this.decodedPackets++ < goodPackets) return super.decode(chunk);
        super.decode(new EncodedAudioChunk({ type: 'key', timestamp: chunk.timestamp, data: new Uint8Array(64).fill(0xff) }));
      }
    };
    const realDecodeAudioData = BaseAudioContext.prototype.decodeAudioData;
    if (decoding === 'all-fail') {
      BaseAudioContext.prototype.decodeAudioData = () => Promise.reject(new DOMException('Unable to decode audio data', 'EncodingError'));
    }
    return () => {
      page.AudioDecoder = RealAudioDecoder;
      BaseAudioContext.prototype.decodeAudioData = realDecodeAudioData;
    };
  }

  private layerDecoder(decoding: FixtureLayerDecoding): AudioLayerDecoder {
    const failing: AudioLayerDecoder = { decode: async () => { throw new Error('This decoder never decodes.'); } };
    switch (decoding) {
      case 'default':
        return new FallbackAudioLayerDecoder(new MediaBunnyAudioLayerDecoder(), new WebAudioAudioLayerDecoder());
      case 'primary-fails':
        return new FallbackAudioLayerDecoder(failing, new WebAudioAudioLayerDecoder());
      case 'all-fail':
        return new FallbackAudioLayerDecoder(failing, failing);
    }
  }

  private countingDecoder(decoder: AudioLayerDecoder, decodes: Map<Blob, number>): AudioLayerDecoder {
    return {
      decode: (source, sampleRate) => {
        decodes.set(source, (decodes.get(source) ?? 0) + 1);
        return decoder.decode(source, sampleRate);
      },
    };
  }

  private codecSelector(codec: AudioCodec | null | undefined): AudioMixCodecSelector {
    if (codec === undefined) return new EncodableAudioMixCodecSelector();
    return { select: async () => codec };
  }

  private planesOf(sample: AudioSample): Float32Array[] {
    const planes: Float32Array[] = [];
    for (let planeIndex = 0; planeIndex < sample.numberOfChannels; planeIndex++) {
      const plane = new Float32Array(sample.numberOfFrames);
      sample.copyTo(plane, { planeIndex, format: 'f32-planar' });
      planes.push(plane);
    }
    return planes;
  }

  private joined(pieces: ReadonlyArray<Float32Array[]>, numberOfChannels: number): Float32Array[] {
    const frames = pieces.reduce((total, piece) => total + (piece[0]?.length ?? 0), 0);
    const channels: Float32Array[] = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const joined = new Float32Array(frames);
      let offset = 0;
      for (const piece of pieces) {
        joined.set(piece[channel] ?? new Float32Array(piece[0]!.length), offset);
        offset += piece[0]!.length;
      }
      channels.push(joined);
    }
    return channels;
  }
}
