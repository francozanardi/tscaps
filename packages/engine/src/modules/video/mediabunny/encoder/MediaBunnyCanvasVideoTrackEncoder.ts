import { CanvasSource, type Output, type VideoEncodingConfig } from 'mediabunny';
import type {
  PaintFrame,
  VideoTrackEncoder,
} from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

export interface MediaBunnyCanvasVideoTrackEncoderConfig {
  width: number;
  height: number;
  /** Keeps transparency; the canvas is cleared before every paint. Pair with `encoderConfig.alpha: 'keep'`. */
  alpha: boolean;
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
  private readonly alpha: boolean;

  constructor(config: MediaBunnyCanvasVideoTrackEncoderConfig) {
    this.width = config.width;
    this.height = config.height;
    this.alpha = config.alpha;
    this.canvas = new OffscreenCanvas(config.width, config.height);
    // alpha:false unless asked for — an opaque output's paint covers every
    // pixel, so a channel nobody reads is not worth carrying.
    // imageSmoothingEnabled:false — free whenever the output keeps the
    // source's dimensions, which is the common path. It is not free when
    // an export asks for smaller ones: the source frame is then scaled
    // down unsmoothed, straight into the encoder. Whether that shows
    // enough to be worth the smoothing is unmeasured, so the flag stays
    // as it was rather than moving on an argument alone.
    const ctx = this.canvas.getContext('2d', {
      alpha: config.alpha,
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
    if (this.alpha) this.context.clearRect(0, 0, this.width, this.height);
    paint(this.context);
    await this.canvasSource.add(timestamp, duration);
  }
}
