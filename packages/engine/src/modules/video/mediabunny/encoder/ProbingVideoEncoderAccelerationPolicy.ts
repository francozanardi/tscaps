import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  type VideoEncodingConfig,
} from 'mediabunny';
import type { VideoEncoderAcceleration, VideoEncoderSelection } from '@modules/video/RenderJob';
import type { VideoEncoderProbeObserver } from '@modules/video/mediabunny/encoder/VideoEncoderProbeObserver';
import type {
  VideoEncoderAccelerationPolicy,
  VideoEncoderAccelerationRequest,
  VideoEncoderAccelerationResult,
} from '@modules/video/mediabunny/encoder/VideoEncoderAccelerationPolicy';

/**
 * Encodes one frame with the run's own config before the run starts, and
 * moves the run to a software encoder when the browser's default refuses
 * it.
 *
 * Some hardware encoders accept a config and then reject the very first
 * frame (`OperationError: Encoding error. (Unexpected frame format.)` on
 * some Windows machines), which no `isConfigSupported` answer predicts.
 * The probe goes through the same path the run will: an
 * {@link OffscreenCanvas} with the run's context options, handed to a
 * mediabunny {@link CanvasSource} with the run's config.
 *
 * The software encoder is only chosen after a frame has gone through it
 * too, so a browser that rejects the hint, or whose software encoder
 * also fails, keeps the default and fails the way it did before. Costs
 * one encoder set-up and one encoded frame per run, twice when the
 * default fails. A refused default is told to the observer.
 */
export class ProbingVideoEncoderAccelerationPolicy implements VideoEncoderAccelerationPolicy {

  constructor(private readonly observer: VideoEncoderProbeObserver | null = null) {}

  async select(request: VideoEncoderAccelerationRequest): Promise<VideoEncoderAccelerationResult> {
    const defaultEncoderFailure = await this.probe(request, 'no-preference');
    if (defaultEncoderFailure === null) {
      return {
        encoderConfig: request.encoderConfig,
        selection: { acceleration: 'no-preference', defaultEncoderFailure: null, softwareEncoderFailure: null },
      };
    }
    const result = await this.selectAfterRefusal(request, defaultEncoderFailure);
    this.observer?.onDefaultEncoderRefused({
      codec: request.encoderConfig.codec,
      width: request.width,
      height: request.height,
      selection: result.selection,
    });
    return result;
  }

  /** Software when a frame goes through it; otherwise the default, which is expected to fail as its probe did. */
  private async selectAfterRefusal(
    request: VideoEncoderAccelerationRequest,
    defaultEncoderFailure: string,
  ): Promise<VideoEncoderAccelerationResult> {
    const softwareEncoderFailure = await this.probe(request, 'prefer-software');
    const selection: VideoEncoderSelection = {
      acceleration: softwareEncoderFailure === null ? 'prefer-software' : 'no-preference',
      defaultEncoderFailure,
      softwareEncoderFailure,
    };
    return {
      encoderConfig: this.withAcceleration(request.encoderConfig, selection.acceleration),
      selection,
    };
  }

  /** Encodes one frame; returns `null` when it went through, or the failure as `'name: message'`. */
  private async probe(
    request: VideoEncoderAccelerationRequest,
    acceleration: VideoEncoderAcceleration,
  ): Promise<string | null> {
    const config = this.withAcceleration(request.encoderConfig, acceleration);
    const output = new Output({ format: this.formatFor(config), target: new BufferTarget() });
    try {
      const canvas = new OffscreenCanvas(request.width, request.height);
      const context = canvas.getContext('2d', { alpha: request.alpha, desynchronized: false, willReadFrequently: false });
      if (!context) throw new Error('Unable to acquire a 2D context on the offscreen canvas');
      context.fillStyle = '#808080';
      context.fillRect(0, 0, request.width, request.height);
      const source = new CanvasSource(canvas, config);
      output.addVideoTrack(source);
      await output.start();
      await source.add(0, 1 / 30);
      // The encoder reports a refused frame asynchronously; finalizing
      // flushes it, which is what surfaces the error.
      await output.finalize();
      return null;
    } catch (error) {
      await this.cancelQuietly(output);
      return this.describe(error);
    }
  }

  private withAcceleration(config: VideoEncodingConfig, acceleration: VideoEncoderAcceleration): VideoEncodingConfig {
    if (acceleration === 'no-preference') return config;
    return { ...config, hardwareAcceleration: acceleration };
  }

  /** A container that takes the codec; the probe's bytes are thrown away. */
  private formatFor(config: VideoEncodingConfig): Mp4OutputFormat | WebMOutputFormat {
    return config.codec === 'vp8' ? new WebMOutputFormat() : new Mp4OutputFormat();
  }

  private describe(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  }

  private async cancelQuietly(output: Output): Promise<void> {
    if (output.state === 'finalized' || output.state === 'canceled') return;
    try {
      await output.cancel();
    } catch {
      // Best-effort: the probe's verdict is already the failure that got here.
    }
  }
}
