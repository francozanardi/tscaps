import {
  Input,
  BlobSource,
  ALL_FORMATS,
  type BufferTarget,
  type Output,
  type VideoEncodingConfig,
} from 'mediabunny';
import { RenderTimeMap } from '@modules/video/RenderTimeMap';
import type {
  OutputFormat,
  RenderOutputChunk,
  RenderProgress,
  RenderQuality,
  AudioDiscardReason,
  FallbackDecoderInfo,
} from '@modules/video/RenderJob';
import type { CodecPolicy, VideoCodecResolution } from '@modules/video/mediabunny/codec/CodecPolicy';
import type { VideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { AudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { OutputTargetBuilder } from '@modules/video/mediabunny/output/OutputTargetBuilder';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { VideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/VideoTrackEncoderFactory';
import type { FramePainter } from '@modules/video/mediabunny/painter/FramePainter';

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
  onProgress?: (progress: RenderProgress) => void;
  onAudioDiscarded?: (reason: AudioDiscardReason) => void;
  confirmFallbackDecoder?: (info: FallbackDecoderInfo) => Promise<boolean>;
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
  painter: FramePainter;
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
        painter: request.painter,
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

  // One decoded video frame is alive at any time: holding more would
  // back-pressure the WebCodecs frame pool into a stall.
  private async runEncodeLoop(params: EncodeLoopParams): Promise<void> {
    let frameCount = 0;

    for await (const frame of params.decoder.samples()) {
      try {
        if (frame.timestamp < 0) continue;
        if (params.timeMap.isSkipped(frame.timestamp)) continue;

        const outputTimestamp = params.timeMap.toOutputTime(frame.timestamp);
        const paintFrame = await params.painter.paint(frame, outputTimestamp);
        await params.encoder.encode(outputTimestamp, frame.duration, paintFrame);
        await params.audioBridge.pumpUntil(frame.timestamp);
        frameCount++;
        if (params.onProgress) {
          params.onProgress(this.toProgress(outputTimestamp, params.outputDuration, frameCount));
        }
      } finally {
        frame.close();
      }
    }
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

  private toProgress(timestamp: number, duration: number, frameCount: number): RenderProgress {
    const percent = duration > 0 ? Math.min(100, Math.round((timestamp / duration) * 100)) : 0;
    return { percent, currentFrame: frameCount, totalFrames: 0 };
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
