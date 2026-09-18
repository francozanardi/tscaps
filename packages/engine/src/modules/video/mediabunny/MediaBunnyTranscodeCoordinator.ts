import {
  Input,
  BlobSource,
  ALL_FORMATS,
  type BufferTarget,
  type Output,
  type VideoEncodingConfig,
} from 'mediabunny';
import { RenderTimeMap, type TimeRange } from '@modules/video/RenderTimeMap';
import type {
  OutputFormat,
  RenderOutputChunk,
  RenderProgress,
  RenderQuality,
  AudioDiscardReason,
  FallbackDecoderInfo,
  VideoFrameDecoderSelection,
} from '@modules/video/RenderJob';
import type { CodecPolicy, VideoCodecResolution } from '@modules/video/mediabunny/codec/CodecPolicy';
import type { VideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { AudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { OutputTargetBuilder } from '@modules/video/mediabunny/output/OutputTargetBuilder';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { VideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/VideoTrackEncoderFactory';
import type { FramePainter, FramePaintRequest } from '@modules/video/mediabunny/painter/FramePainter';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { RetainedVideoFrame } from '@modules/video/mediabunny/frame/RetainedVideoFrame';

export interface MediaBunnyTranscodeCoordinatorConfig {
  videoFrameDecoderFactory: VideoFrameDecoderFactory;
  videoTrackEncoderFactory: VideoTrackEncoderFactory;
  audioTrackBridgeFactory: AudioTrackBridgeFactory;
  outputTargetBuilder: OutputTargetBuilder;
}

export interface MediaBunnyTranscodeRequest {
  source: File;
  /**
   * Resolves the codec, bitrate, and encoder knobs for this run. Per-request
   * so consumers can supply a fixed policy (e.g. a proxy generator that
   * always wants low-bitrate AVC) without swapping the coordinator instance.
   */
  codecPolicy: CodecPolicy;
  /**
   * Owns the per-frame pixel work. See {@link FramePainter} for the
   * lifecycle contract.
   */
  painter: FramePainter;
  /**
   * Target output dimensions. When omitted, the coordinator keeps the
   * input track's intrinsic display dimensions. When set, the source
   * frames are painted at these dimensions; the coordinator never
   * upscales beyond the source and snaps both axes to even numbers,
   * which most hardware video encoders require. Callers are
   * responsible for keeping the aspect ratio consistent — the
   * coordinator does not letterbox or crop.
   */
  outputResolution?: { width: number; height: number };
  outputFormat?: OutputFormat;
  quality?: RenderQuality;
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
  confirmFallbackDecoder?: (info: FallbackDecoderInfo) => Promise<boolean>;
  onVideoFrameDecoderSelected?: (selection: VideoFrameDecoderSelection) => void;
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
  painter: FramePainter;
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
 * Consumer-specific per-frame composition (captions, overlay, raw-frame
 * passthrough) lives behind the request's {@link FramePainter}; codec
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
  private readonly audioTrackBridgeFactory: AudioTrackBridgeFactory;
  private readonly outputTargetBuilder: OutputTargetBuilder;

  constructor(config: MediaBunnyTranscodeCoordinatorConfig) {
    this.videoFrameDecoderFactory = config.videoFrameDecoderFactory;
    this.videoTrackEncoderFactory = config.videoTrackEncoderFactory;
    this.audioTrackBridgeFactory = config.audioTrackBridgeFactory;
    this.outputTargetBuilder = config.outputTargetBuilder;
  }

  async execute(request: MediaBunnyTranscodeRequest): Promise<MediaBunnyTranscodeResult> {
    this.assertWebCodecsAvailable();

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(request.source) });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error('No video track found in the input file');
    }

    const { width, height } = this.resolveOutputDimensions(
      videoTrack.displayWidth,
      videoTrack.displayHeight,
      request.outputResolution,
    );
    const fps = await this.readFrameRate(videoTrack);
    const timeMap = request.timeMap ?? new RenderTimeMap([]);

    const { output, target, format } = this.outputTargetBuilder.build({
      format: request.outputFormat,
      stream: request.outputStream,
    });

    const codecResolution = await request.codecPolicy.resolveVideo({
      supportedCodecs: format.getSupportedVideoCodecs(),
      width,
      height,
      fps,
      quality: request.quality,
    });

    const encoder = this.videoTrackEncoderFactory.create({
      width,
      height,
      encoderConfig: this.toEncoderConfig(codecResolution),
    });
    encoder.attachTo(output);

    const audioBridge = await this.audioTrackBridgeFactory.create({
      input,
      format,
      timeMap,
      ...(request.onAudioDiscarded ? { onAudioDiscarded: request.onAudioDiscarded } : {}),
    });
    await audioBridge.attachTo(output);

    const decoder = await this.videoFrameDecoderFactory.create({
      track: videoTrack,
      source: request.source,
      ...(request.confirmFallbackDecoder ? { confirmFallback: request.confirmFallbackDecoder } : {}),
      ...(request.onVideoFrameDecoderSelected ? { onDecoderSelected: request.onVideoFrameDecoderSelected } : {}),
    });

    const sourceDuration = await this.computeDuration(videoTrack);
    const outputDuration = Math.max(0, sourceDuration - timeMap.totalSkipDuration());

    let painterStarted = false;
    try {
      await request.painter.begin(width, height, fps);
      painterStarted = true;
      await output.start();
      await this.runEncodeLoop({
        decoder,
        encoder,
        audioBridge,
        timeMap,
        outputDuration,
        totalFrames: Math.round(outputDuration * fps),
        painter: request.painter,
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
      if (painterStarted) request.painter.end();
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
    const lookAhead = Math.max(1, params.painter.lookAhead());
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
   */
  private toPaintRequest(
    frame: DecodedVideoFrame,
    params: EncodeLoopParams,
    lookAhead: number,
  ): FramePaintRequest {
    const outputTimestamp = params.timeMap.toOutputTime(frame.timestamp);
    if (lookAhead === 1) return { frame, outputTimestamp };
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
   * Paints a whole run, then encodes and pumps audio for each of its
   * frames in order. Empties `group` on the way out, closing every
   * frame it held. Returns the running output-frame count.
   */
  private async encodeGroup(
    group: FramePaintRequest[],
    params: EncodeLoopParams,
    frameCount: number,
  ): Promise<number> {
    if (group.length === 0) return frameCount;
    let counted = frameCount;
    try {
      const paints = await params.painter.paint(group);
      if (paints.length !== group.length) {
        throw new Error(
          `The painter returned ${paints.length} paint steps for a run of ${group.length} frames.`,
        );
      }
      for (const [i, request] of group.entries()) {
        await params.encoder.encode(request.outputTimestamp, request.frame.duration, paints[i]!);
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

  private closeGroup(group: FramePaintRequest[]): void {
    for (const request of group) request.frame.close();
    group.length = 0;
  }

  private toEncoderConfig(resolution: VideoCodecResolution): VideoEncodingConfig {
    const config: VideoEncodingConfig = {
      codec: resolution.codec,
      bitrate: resolution.bitrate,
      bitrateMode: resolution.bitrateMode,
      latencyMode: resolution.latencyMode,
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

  private resolveOutputDimensions(
    sourceWidth: number,
    sourceHeight: number,
    requested: { width: number; height: number } | undefined,
  ): { width: number; height: number } {
    if (!requested) return { width: sourceWidth, height: sourceHeight };
    const width = Math.min(requested.width, sourceWidth);
    const height = Math.min(requested.height, sourceHeight);
    return { width: this.toEven(width), height: this.toEven(height) };
  }

  private toEven(value: number): number {
    const rounded = Math.round(value);
    return rounded % 2 === 0 ? rounded : rounded - 1;
  }

  private async readFrameRate(
    videoTrack: { computePacketStats(targetPacketCount?: number): Promise<{ averagePacketRate: number }> },
  ): Promise<number> {
    try {
      const stats = await videoTrack.computePacketStats(120);
      if (Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0) {
        return stats.averagePacketRate;
      }
    } catch {
      // Falls through to the default.
    }
    console.warn('Could not determine input frame rate; defaulting to 30 fps');
    return 30;
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
