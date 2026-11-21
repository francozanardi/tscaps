import {
  Input,
  BlobSource,
  ALL_FORMATS,
  type VideoSample,
  type BufferTarget,
  type InputVideoTrack,
  type Output,
  type OutputFormat as MediaBunnyOutputFormat,
  type Rotation,
  type VideoCodec,
  type VideoEncodingConfig,
} from 'mediabunny';
import { RenderTimeMap, type TimeRange } from '@modules/video/RenderTimeMap';
import type {
  OutputFormat,
  RenderOutputChunk,
  RenderProgress,
  RenderQuality,
  AudioDiscardReason,
  AudioMixDropReason,
  FallbackDecoderInfo,
  RenderAudioMix,
  VideoFrameDecoderSelection,
  VideoEncoderSelection,
} from '@modules/video/RenderJob';
import type { CodecPolicy, VideoCodecResolution } from '@modules/video/mediabunny/codec/CodecPolicy';
import type { VideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { AudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { OutputTargetBuilder } from '@modules/video/mediabunny/output/OutputTargetBuilder';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { VideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/VideoTrackEncoderFactory';
import type { VideoEncoderAccelerationPolicy } from '@modules/video/mediabunny/encoder/VideoEncoderAccelerationPolicy';
import type { FramePainter, FramePaintRequest } from '@modules/video/mediabunny/painter/FramePainter';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { RetainedVideoFrame } from '@modules/video/mediabunny/frame/RetainedVideoFrame';
import { RenderOutputDimensions } from '@modules/video/mediabunny/output/RenderOutputDimensions';
import { SourceFrameRateReader } from '@modules/video/mediabunny/frame/SourceFrameRateReader';

export interface MediaBunnyTranscodeCoordinatorConfig {
  videoFrameDecoderFactory: VideoFrameDecoderFactory;
  videoTrackEncoderFactory: VideoTrackEncoderFactory;
  videoEncoderAccelerationPolicy: VideoEncoderAccelerationPolicy;
  audioTrackBridgeFactory: AudioTrackBridgeFactory;
  outputTargetBuilder: OutputTargetBuilder;
}

export interface MediaBunnyTranscodeRequest {
  source: Blob;
  /**
   * Resolves the codec, bitrate, and encoder knobs for this run. Per-request
   * so consumers can supply a fixed policy (e.g. a proxy generator that
   * always wants low-bitrate AVC) without swapping the coordinator instance.
   */
  codecPolicy: CodecPolicy;
  /**
   * Owns the per-frame pixel work. See {@link FramePainter} for the
   * lifecycle contract.
   *
   * Omitted when each output frame is its source frame as decoded. The
   * frames then go to the encoder as they are, never drawn: the output
   * keeps the source's size, and a rotated source keeps its rotation as
   * metadata rather than in its pixels. Such a run is refused before it
   * starts when it asks for a smaller `outputResolution` or its format
   * cannot declare the source's rotation, and fails when its decoder does
   * not lend its frames, as the `<video>`-element fallback does not.
   */
  painter?: FramePainter;
  /**
   * Target output dimensions. When omitted, the coordinator keeps the
   * input track's intrinsic display dimensions. When set, the source
   * frames are painted at these dimensions; the coordinator never
   * upscales beyond the frame and snaps both axes to even numbers,
   * which most hardware video encoders require. Callers are
   * responsible for keeping the frame's aspect ratio — the coordinator
   * does not letterbox or crop.
   */
  outputResolution?: { width: number; height: number };
  /**
   * The output frame's own size, before `outputResolution`, where it is
   * not the source's display size. The painter places the source's
   * picture in it. Defaults to the source's display size.
   */
  frame?: { width: number; height: number };
  outputFormat?: OutputFormat;
  quality?: RenderQuality;
  /** `false` when the painter never draws the source frames, so they are timed but not decoded. Defaults to `true`. */
  sourcePixels?: boolean;
  /** Keeps the frames' transparency (WebM through VP9/VP8 only; other formats are rejected). */
  alpha?: boolean;
  /** `'discard'` drops the source's audio. Defaults to `'keep'`. */
  audio?: 'keep' | 'discard';
  /**
   * Sounds mixed with the source's audio, and its level. With layers,
   * the output's audio is mixed and re-encoded, and carries a track even
   * when the source has none or its audio is discarded. Without layers,
   * a level other than 1 is applied the same way to source audio that is
   * kept.
   */
  audioMix?: RenderAudioMix;
  /**
   * Sink for the encoded bytes. When set, the coordinator writes chunks
   * to it as the encoder produces them and the result's `blob` is
   * `null`. When unset, the encoded file accumulates in memory and is
   * returned via the result's `blob`.
   */
  outputStream?: WritableStream<RenderOutputChunk>;
  /**
   * Time windows to exclude from the output. Frames and audio inside
   * each window are dropped, and everything after is shifted earlier by
   * the window's duration. Defaults to an empty map (nothing skipped).
   */
  timeMap?: RenderTimeMap;
  /**
   * Abandons the run. Checked between frames, so it stops cleanly
   * rather than mid-write; the partial output is discarded and cannot
   * be resumed. Rejects with an `AbortError`, which callers should
   * distinguish from a transcode failure by name.
   */
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
  onAudioDiscarded?: (reason: AudioDiscardReason) => void;
  onAudioMixDropped?: (reason: AudioMixDropReason) => void;
  onAudioMixInputFallback?: (cause: unknown) => void;
  confirmFallbackDecoder?: (info: FallbackDecoderInfo) => Promise<boolean>;
  confirmUndecodableAudioLayers?: (layerIds: ReadonlyArray<string>) => Promise<boolean>;
  onVideoFrameDecoderSelected?: (selection: VideoFrameDecoderSelection) => void;
  /** Called once, before the output opens, with how the video encoder was chosen. */
  onVideoEncoderSelected?: (selection: VideoEncoderSelection) => void;
}

export interface MediaBunnyTranscodeResult {
  /** Encoded file in memory, or `null` when the request supplied `outputStream`. */
  blob: Blob | null;
  mimeType: string;
  /** Final output width, after clamping to the source and snapping to even. */
  width: number;
  /** Final output height, after clamping to the source and snapping to even. */
  height: number;
}

interface EncodeLoopParams {
  decoder: VideoFrameDecoder;
  encoder: VideoTrackEncoder;
  audioBridge: AudioTrackBridge;
  timeMap: RenderTimeMap;
  outputDuration: number;
  totalFrames: number;
  /** `null` when the frames are encoded as decoded. */
  painter: FramePainter | null;
  /** Whether the frames carry pixels; frames that carry only timing need no copying. */
  sourcePixels: boolean;
  width: number;
  height: number;
  signal: AbortSignal | undefined;
  onProgress: ((progress: RenderProgress) => void) | undefined;
}

/**
 * Runs one mediabunny transcode: opens the source input, resolves the
 * output dimensions / frame rate / duration, wires the encoder and the
 * audio bridge, and drives the decode → paint → encode loop.
 *
 * Consumer-specific per-frame composition (captions, overlay) lives
 * behind the request's {@link FramePainter}, and a request without one
 * has its frames encoded as decoded; codec
 * choice, container format, time-range skipping, and audio-loss and
 * fallback-decoder notifications are per-request inputs. The coordinator
 * itself knows nothing about documents, styles, or overlays — those
 * live inside the painter.
 *
 * One run at a time per instance; concurrent {@link execute} calls on
 * the same instance are not supported.
 */
export class MediaBunnyTranscodeCoordinator {

  /**
   * Shortest cut worth seeking past. A seek resumes at the key frame
   * before it, and measured h264 sources key every 1.0-3.5 s.
   */
  private static readonly MIN_SEEK_SKIP_SEC = 3;

  private readonly videoFrameDecoderFactory: VideoFrameDecoderFactory;
  private readonly videoTrackEncoderFactory: VideoTrackEncoderFactory;
  private readonly videoEncoderAccelerationPolicy: VideoEncoderAccelerationPolicy;
  private readonly audioTrackBridgeFactory: AudioTrackBridgeFactory;
  private readonly outputTargetBuilder: OutputTargetBuilder;

  constructor(config: MediaBunnyTranscodeCoordinatorConfig) {
    this.videoFrameDecoderFactory = config.videoFrameDecoderFactory;
    this.videoTrackEncoderFactory = config.videoTrackEncoderFactory;
    this.videoEncoderAccelerationPolicy = config.videoEncoderAccelerationPolicy;
    this.audioTrackBridgeFactory = config.audioTrackBridgeFactory;
    this.outputTargetBuilder = config.outputTargetBuilder;
  }

  /** The codecs a transparent output can be written with, in order of preference. */
  private static readonly ALPHA_CODECS: ReadonlyArray<VideoCodec> = ['vp9', 'vp8'];

  async execute(request: MediaBunnyTranscodeRequest): Promise<MediaBunnyTranscodeResult> {
    this.assertWebCodecsAvailable();
    const alpha = request.alpha ?? false;
    if (alpha && request.outputFormat !== 'webm') {
      throw new Error(`A transparent output needs the WebM format; ${request.outputFormat ?? 'mp4'} cannot carry alpha.`);
    }

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(request.source) });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error('No video track found in the input file');
    }

    const { width, height } = new RenderOutputDimensions().resolve(
      request.frame ?? { width: videoTrack.displayWidth, height: videoTrack.displayHeight },
      request.outputResolution,
    );
    const fps = await new SourceFrameRateReader().read(videoTrack);
    const timeMap = request.timeMap ?? new RenderTimeMap([]);

    const { output, target, format } = this.outputTargetBuilder.build({
      format: request.outputFormat,
      stream: request.outputStream,
    });

    const painter = request.painter ?? null;
    if (!painter) this.assertKeepsSourceSize(videoTrack, { width, height });
    const rotation = painter ? 0 : await videoTrack.getRotation();
    this.assertFormatDeclaresRotation(format, rotation);
    const stored = this.storedDimensions({ width, height }, rotation);

    const codecResolution = await request.codecPolicy.resolveVideo({
      supportedCodecs: this.codecsFor(format.getSupportedVideoCodecs(), alpha),
      width,
      height,
      fps,
      quality: request.quality,
    });

    const { encoderConfig, selection } = await this.videoEncoderAccelerationPolicy.select({
      width: stored.width,
      height: stored.height,
      alpha,
      frames: painter ? 'painted' : 'decoded',
      encoderConfig: this.toEncoderConfig(codecResolution, alpha),
    });
    request.onVideoEncoderSelected?.(selection);

    const encoder = this.videoTrackEncoderFactory.create({
      width: stored.width,
      height: stored.height,
      alpha,
      rotation,
      encoderConfig,
    });
    encoder.attachTo(output);

    const sourceDuration = await this.computeDuration(videoTrack);
    const outputDuration = Math.max(0, sourceDuration - timeMap.totalSkipDuration());

    const audioBridge = await this.audioTrackBridgeFactory.create({
      input,
      source: request.source,
      format,
      timeMap,
      outputDurationSec: outputDuration,
      wanted: request.audio !== 'discard',
      ...(request.audioMix ? { mix: request.audioMix } : {}),
      ...(request.onAudioDiscarded ? { onAudioDiscarded: request.onAudioDiscarded } : {}),
      ...(request.onAudioMixDropped ? { onAudioMixDropped: request.onAudioMixDropped } : {}),
      ...(request.onAudioMixInputFallback ? { onInputAudioFallback: request.onAudioMixInputFallback } : {}),
      ...(request.confirmUndecodableAudioLayers ? { confirmUndecodableLayers: request.confirmUndecodableAudioLayers } : {}),
    });
    await audioBridge.attachTo(output);

    const decoder = await this.videoFrameDecoderFactory.create({
      track: videoTrack,
      source: request.source,
      pixels: request.sourcePixels ?? true,
      ...(request.confirmFallbackDecoder ? { confirmFallback: request.confirmFallbackDecoder } : {}),
      ...(request.onVideoFrameDecoderSelected ? { onDecoderSelected: request.onVideoFrameDecoderSelected } : {}),
    });

    let painterStarted = false;
    try {
      if (painter) {
        await painter.begin(width, height, fps, videoTrack.displayWidth, videoTrack.displayHeight);
        painterStarted = true;
      }
      await output.start();
      await this.runEncodeLoop({
        decoder,
        encoder,
        audioBridge,
        timeMap,
        outputDuration,
        totalFrames: Math.round(outputDuration * fps),
        painter,
        sourcePixels: request.sourcePixels ?? true,
        width,
        height,
        signal: request.signal,
        onProgress: request.onProgress,
      });
      await audioBridge.finish();
      await output.finalize();
    } catch (err) {
      await this.safeCancel(output);
      throw err;
    } finally {
      decoder.close();
      if (painterStarted) painter?.end();
    }

    return this.buildResult(target, request.outputFormat, width, height);
  }

  /**
   * Drives decode → paint → encode, handing the painter runs of frames
   * as long as it asked for.
   *
   * Only one frame the decoder lent us is ever alive: holding several
   * would back-pressure the WebCodecs frame pool into a stall. A run
   * longer than one frame is therefore held as copies of our own, paid
   * for in a full-frame draw and the pixels of every frame in the run.
   */
  private async runEncodeLoop(params: EncodeLoopParams): Promise<void> {
    const lookAhead = params.painter ? Math.max(1, params.painter.lookAhead()) : 1;
    const group: FramePaintRequest[] = [];
    let decodedCount = 0;
    let frameCount = 0;

    try {
      for (const span of this.decodeSpansFor(params)) {
        for await (const frame of params.decoder.samples(span)) {
          // Checked before the frame joins the group, so it is closed here
          // rather than left to the `finally`.
          if (params.signal?.aborted) {
            frame.close();
            throw new DOMException('The transcode was aborted.', 'AbortError');
          }
          decodedCount++;
          if (frame.timestamp < 0 || params.timeMap.isSkipped(frame.timestamp)) {
            frame.close();
            continue;
          }
          group.push(this.toPaintRequest(frame, params, lookAhead));
          if (group.length < lookAhead) continue;
          frameCount = await this.encodeGroup(group, params, frameCount);
        }
      }
      // Whatever the last run was short of: the decoder ended before the
      // painter's reach filled up, which is the normal way a render ends.
      await this.encodeGroup(group, params, frameCount);
    } finally {
      // A run abandoned half-gathered still holds frames nobody will
      // encode: the decoder threw partway, or retaining one did.
      this.closeGroup(group);
    }

    // Some decoders drop undecodable samples silently instead of erroring.
    // Finalizing with zero decoded frames would emit an output whose video
    // track is empty — readers of that file see no video track at all.
    if (decodedCount === 0) {
      throw new Error('The video decoder produced no frames for this input.');
    }
  }

  /** The stretches to read, or the whole track when the decoder cannot seek. */
  private decodeSpansFor(params: EncodeLoopParams): ReadonlyArray<TimeRange | undefined> {
    if (!params.decoder.canSeek()) return [undefined];
    return params.timeMap.decodeSpans(MediaBunnyTranscodeCoordinator.MIN_SEEK_SKIP_SEC);
  }

  /**
   * The frame as the painter will receive it. A run of one is handed the
   * decoder's own frame, which the run closes when it is done with it. A
   * longer run outlives what the decoder will lend, so the pixels are
   * copied and its frame handed straight back — whether or not the copy
   * succeeds, since a frame the decoder never gets back stalls its pool.
   * A frame that carries timing only holds nothing to lend, so it is kept
   * as it is.
   */
  private toPaintRequest(
    frame: DecodedVideoFrame,
    params: EncodeLoopParams,
    lookAhead: number,
  ): FramePaintRequest {
    const outputTimestamp = params.timeMap.toOutputTime(frame.timestamp);
    if (lookAhead === 1 || !params.sourcePixels) return { frame, outputTimestamp };
    try {
      return {
        frame: RetainedVideoFrame.copyOf(frame, params.width, params.height),
        outputTimestamp,
      };
    } finally {
      frame.close();
    }
  }

  /**
   * Paints a whole run, or takes its frames as decoded when there is no
   * painter, then encodes and pumps audio for each of its frames in
   * order. Empties `group` on the way out, closing every frame it held.
   * Returns the running output-frame count.
   */
  private async encodeGroup(
    group: FramePaintRequest[],
    params: EncodeLoopParams,
    frameCount: number,
  ): Promise<number> {
    if (group.length === 0) return frameCount;
    let counted = frameCount;
    try {
      const paints = params.painter ? await this.paintGroup(params.painter, group) : null;
      for (const [i, request] of group.entries()) {
        await this.encodeFrame(params.encoder, request, paints?.[i] ?? null);
        await params.audioBridge.pumpUntil(request.frame.timestamp);
        counted++;
        if (params.onProgress) {
          params.onProgress(this.toProgress(params, request.outputTimestamp, counted));
        }
      }
    } finally {
      this.closeGroup(group);
    }
    return counted;
  }

  private async paintGroup(painter: FramePainter, group: FramePaintRequest[]): Promise<PaintFrame[]> {
    const paints = await painter.paint(group);
    if (paints.length !== group.length) {
      throw new Error(
        `The painter returned ${paints.length} paint steps for a run of ${group.length} frames.`,
      );
    }
    return paints;
  }

  /** Encodes one frame as painted, or as decoded when there is no paint step for it. */
  private async encodeFrame(encoder: VideoTrackEncoder, request: FramePaintRequest, paint: PaintFrame | null): Promise<void> {
    if (paint) {
      await encoder.encode(request.outputTimestamp, request.frame.duration, paint);
      return;
    }
    await encoder.encodeAsDecoded(this.lentSampleOf(request.frame), request.outputTimestamp, request.frame.duration);
  }

  private lentSampleOf(frame: DecodedVideoFrame): VideoSample {
    if (!frame.sample) {
      throw new Error('The decoder lent no frame to encode as decoded; a decoder that does not lend its frames needs a painter.');
    }
    return frame.sample;
  }

  /** Frames encoded as decoded keep the source's size, so a run without a painter cannot shrink them. */
  private assertKeepsSourceSize(videoTrack: InputVideoTrack, output: { width: number; height: number }): void {
    if (output.width === videoTrack.displayWidth && output.height === videoTrack.displayHeight) return;
    throw new Error(
      `Frames encoded as decoded keep the source's ${videoTrack.displayWidth}x${videoTrack.displayHeight}; ` +
        `a ${output.width}x${output.height} output needs a painter.`,
    );
  }

  /**
   * Frames encoded as decoded keep the source's rotation as metadata, so a format that cannot
   * declare it would play them sideways. Mediabunny writes the metadata regardless of what the
   * format declares, so the refusal has to be made here.
   */
  private assertFormatDeclaresRotation(format: MediaBunnyOutputFormat, rotation: Rotation): void {
    if (rotation === 0 || format.supportsVideoTransformationMetadata) return;
    throw new Error(`A ${format.fileExtension} output cannot declare a ${rotation}° rotation; a rotated source needs a painter for it.`);
  }

  /** The frames' dimensions as stored, before the track's rotation turns them for display. */
  private storedDimensions(
    display: { width: number; height: number },
    rotation: Rotation,
  ): { width: number; height: number } {
    if (rotation % 180 === 0) return display;
    return { width: display.height, height: display.width };
  }

  private closeGroup(group: FramePaintRequest[]): void {
    for (const request of group) request.frame.close();
    group.length = 0;
  }

  private codecsFor(supported: VideoCodec[], alpha: boolean): VideoCodec[] {
    if (!alpha) return supported;
    return MediaBunnyTranscodeCoordinator.ALPHA_CODECS.filter((codec) => supported.includes(codec));
  }

  private toEncoderConfig(resolution: VideoCodecResolution, alpha: boolean): VideoEncodingConfig {
    const config: VideoEncodingConfig = {
      codec: resolution.codec,
      bitrate: resolution.bitrate,
      bitrateMode: resolution.bitrateMode,
      latencyMode: resolution.latencyMode,
      alpha: alpha ? 'keep' : 'discard',
    };
    if (resolution.contentHint !== undefined) config.contentHint = resolution.contentHint;
    if (resolution.keyFrameInterval !== undefined) config.keyFrameInterval = resolution.keyFrameInterval;
    return config;
  }

  private async computeDuration(videoTrack: { computeDuration(): Promise<number> }): Promise<number> {
    try {
      return await videoTrack.computeDuration();
    } catch {
      return 0;
    }
  }

  private toProgress(params: EncodeLoopParams, timestamp: number, frameCount: number): RenderProgress {
    const duration = params.outputDuration;
    const percent = duration > 0 ? Math.min(100, Math.round((timestamp / duration) * 100)) : 0;
    return { percent, currentFrame: frameCount, totalFrames: params.totalFrames };
  }

  private async safeCancel(output: Output): Promise<void> {
    if (output.state === 'finalized' || output.state === 'canceled') return;
    try {
      await output.cancel();
    } catch {
      // Cancellation is best-effort; the original error has priority.
    }
  }

  private assertWebCodecsAvailable(): void {
    if (typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'undefined') {
      throw new Error(
        'This browser does not support video encoding (WebCodecs). ' +
          'Use Chrome, Firefox, or Safari 17.4+ on a recent device.',
      );
    }
  }

  private buildResult(
    target: BufferTarget | null,
    format: OutputFormat | undefined,
    width: number,
    height: number,
  ): MediaBunnyTranscodeResult {
    const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
    if (!target) return { blob: null, mimeType, width, height };
    return {
      blob: new Blob([target.buffer!], { type: mimeType }),
      mimeType,
      width,
      height,
    };
  }
}
