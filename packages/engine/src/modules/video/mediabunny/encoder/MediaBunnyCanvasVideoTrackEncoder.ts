import { CanvasSource, type Output, type VideoEncodingConfig } from 'mediabunny';
import type {
  PaintFrame,
  VideoTrackEncoder,
} from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

export interface MediaBunnyCanvasVideoTrackEncoderConfig {
  width: number;
  height: number;
  encoderConfig: VideoEncodingConfig;
}

/**
 * Owns an {@link OffscreenCanvas} sized to the output, a high-quality 2D
 * context, and a {@link CanvasSource} that snapshots the canvas on each
 * {@link encode} call and pushes the result into the output's encoder
 * pipeline.
 *
 * Hides the canvas: callers paint through the {@link PaintFrame} callback
 * passed to `encode`, never against the underlying surface directly.
 */
export class MediaBunnyCanvasVideoTrackEncoder implements VideoTrackEncoder {

  readonly width: number;
  readonly height: number;

  private readonly canvas: OffscreenCanvas;
  private readonly context: OffscreenCanvasRenderingContext2D;
  private readonly canvasSource: CanvasSource;

  constructor(config: MediaBunnyCanvasVideoTrackEncoderConfig) {
    this.width = config.width;
    this.height = config.height;
    this.canvas = new OffscreenCanvas(config.width, config.height);
    // alpha:false — the compositor paints an opaque source frame first;
    // imageSmoothingEnabled:false — compositor always draws at native
    // size, so smoothing is a pure no-op cost.
    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: false,
      willReadFrequently: false,
    });
    if (!ctx) {
      throw new Error('Unable to acquire a 2D context on the offscreen canvas');
    }
    ctx.imageSmoothingEnabled = false;
    this.context = ctx;
    this.canvasSource = new CanvasSource(this.canvas, config.encoderConfig);
  }

  attachTo(output: Output): void {
    output.addVideoTrack(this.canvasSource);
  }

  async encode(timestamp: number, duration: number, paint: PaintFrame): Promise<void> {
    paint(this.context);
    await this.canvasSource.add(timestamp, duration);
  }
}
