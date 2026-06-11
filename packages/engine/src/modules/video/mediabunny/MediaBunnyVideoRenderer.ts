import {
  Input,
  BlobSource,
  ALL_FORMATS,
  type BufferTarget,
  type Output,
  type VideoEncodingConfig,
} from 'mediabunny';
import type { VideoRenderer } from '@modules/video/VideoRenderer';
import type {
  RenderJob,
  RenderResult,
  RenderProgress,
  OutputFormat,
} from '@modules/video/RenderJob';
import type { OverlayFrameRenderer, OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { CodecPolicy, VideoCodecResolution } from '@modules/video/mediabunny/codec/CodecPolicy';
import type { VideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { AudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/AudioTrackBridgeFactory';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { OutputTargetBuilder } from '@modules/video/mediabunny/output/OutputTargetBuilder';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { VideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/VideoTrackEncoderFactory';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';

// Captions step at the video's frame rate up to this cap. Past it,
// per-letter or per-word animations gain nothing from extra renders
// (the eye doesn't resolve sub-30fps differences in caption motion)
// and the per-batch subtitle decode dominates the render budget.
const CAPTION_FPS_CAP = 30;

export interface MediaBunnyVideoRendererConfig {
  /**
   * Produces the caption raster painted onto each output frame. The
   * coordinator does not split styles, snap times to caption ticks,
   * or composite layers — all caption-side strategy lives behind
   * this single source.
   */
  subtitleLayer: SubtitleLayerSource;
  overlayRenderer: OverlayFrameRenderer;
  codecPolicy: CodecPolicy;
  videoFrameDecoderFactory: VideoFrameDecoderFactory;
  videoTrackEncoderFactory: VideoTrackEncoderFactory;
  audioTrackBridgeFactory: AudioTrackBridgeFactory;
  outputTargetBuilder: OutputTargetBuilder;
  frameCompositor: FrameCompositor;
}

interface EncodeLoopParams {
  decoder: VideoFrameDecoder;
  encoder: VideoTrackEncoder;
  audioBridge: AudioTrackBridge;
  duration: number;
  overlay: OverlayFrame | null;
  onProgress: ((progress: RenderProgress) => void) | undefined;
}

/**
 * Renders a `RenderJob` into a mediabunny {@link Output} container.
 *
 * Coordinates the decoder, the subtitle layer source, the frame
 * compositor, the encoder, and the audio bridge. Caption strategy
 * (batching, video-frame sampling, mixed) lives entirely behind the
 * configured {@link SubtitleLayerSource}.
 *
 * One job at a time per instance: concurrent {@link render} calls on
 * the same instance are not supported.
 *
 * Caption ticks step at most at {@link CAPTION_FPS_CAP}; inputs
 * below that cap step at the input's own framerate.
 */
export class MediaBunnyVideoRenderer implements VideoRenderer {

  private readonly subtitleLayer: SubtitleLayerSource;
  private readonly overlayRenderer: OverlayFrameRenderer;
  private readonly codecPolicy: CodecPolicy;
  private readonly videoFrameDecoderFactory: VideoFrameDecoderFactory;
  private readonly videoTrackEncoderFactory: VideoTrackEncoderFactory;
  private readonly audioTrackBridgeFactory: AudioTrackBridgeFactory;
  private readonly outputTargetBuilder: OutputTargetBuilder;
  private readonly frameCompositor: FrameCompositor;

  constructor(config: MediaBunnyVideoRendererConfig) {
    this.subtitleLayer = config.subtitleLayer;
    this.overlayRenderer = config.overlayRenderer;
    this.codecPolicy = config.codecPolicy;
    this.videoFrameDecoderFactory = config.videoFrameDecoderFactory;
    this.videoTrackEncoderFactory = config.videoTrackEncoderFactory;
    this.audioTrackBridgeFactory = config.audioTrackBridgeFactory;
    this.outputTargetBuilder = config.outputTargetBuilder;
    this.frameCompositor = config.frameCompositor;
  }

  async render(
    job: RenderJob,
    onProgress?: (progress: RenderProgress) => void,
  ): Promise<RenderResult> {
    this.assertWebCodecsAvailable();

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(job.video) });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error('No video track found in the input file');
    }
    const { width, height } = this.resolveOutputDimensions(
      videoTrack.displayWidth,
      videoTrack.displayHeight,
      job.outputResolution,
    );
    const fps = await this.readFrameRate(videoTrack);
    const captionInterval = 1 / Math.min(fps, CAPTION_FPS_CAP);

    await this.subtitleLayer.open(job.document, job.styles, width, height, captionInterval);

    const { output, target, format } = this.outputTargetBuilder.build({
      format: job.outputFormat,
      stream: job.outputStream,
    });

    const codecResolution = await this.codecPolicy.resolveVideo({
      supportedCodecs: format.getSupportedVideoCodecs(),
      width,
      height,
      fps,
      quality: job.quality,
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
      ...(job.onAudioDiscarded ? { onAudioDiscarded: job.onAudioDiscarded } : {}),
    });
    await audioBridge.attachTo(output);

    const decoder = await this.videoFrameDecoderFactory.create({
      track: videoTrack,
      source: job.video,
      ...(job.confirmFallbackDecoder ? { confirmFallback: job.confirmFallbackDecoder } : {}),
    });

    const duration = await this.computeDuration(videoTrack);
    const overlay = job.overlayHtml ? await this.overlayRenderer.render(job.overlayHtml, width, height) : null;

    await output.start();

    try {
      await this.runEncodeLoop({ decoder, encoder, audioBridge, duration, overlay, onProgress });
      await audioBridge.finish();
      await output.finalize();
    } catch (err) {
      await this.safeCancel(output);
      throw err;
    } finally {
      decoder.close();
      this.subtitleLayer.close();
    }

    return this.buildResult(target, job.outputFormat);
  }

  // One decoded video frame is alive at any time: holding more would
  // back-pressure the WebCodecs frame pool into a stall.
  private async runEncodeLoop(params: EncodeLoopParams): Promise<void> {
    const width = params.encoder.width;
    const height = params.encoder.height;
    let frameCount = 0;

    for await (const frame of params.decoder.samples()) {
      try {
        if (frame.timestamp < 0) continue;

        const captionLayer = await this.subtitleLayer.frameAt(frame.timestamp, frame);

        await params.encoder.encode(frame.timestamp, frame.duration, (ctx) => {
          this.frameCompositor.compose(ctx, {
            frame,
            captions: captionLayer,
            overlay: params.overlay,
            width,
            height,
          });
        });
        await params.audioBridge.pumpUntil(frame.timestamp);
        frameCount++;
        if (params.onProgress) params.onProgress(this.toProgress(frame.timestamp, params.duration, frameCount));
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
    return config;
  }

  private async computeDuration(videoTrack: { computeDuration(): Promise<number> }): Promise<number> {
    try {
      return await videoTrack.computeDuration();
    } catch {
      return 0;
    }
  }

  /**
   * Resolves the final pixel dimensions for the output. When the caller
   * specifies `outputResolution`, those values win — but the renderer
   * never upscales beyond the source and snaps to even numbers, which
   * most hardware video encoders require.
   */
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

  private buildResult(target: BufferTarget | null, format: OutputFormat | undefined): RenderResult {
    const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
    if (!target) return { blob: null, mimeType };
    return {
      blob: new Blob([target.buffer!], { type: mimeType }),
      mimeType,
    };
  }
}
