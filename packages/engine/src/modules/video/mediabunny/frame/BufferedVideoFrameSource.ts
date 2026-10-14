import type { VideoFrameSource, VideoFrameRegion } from '@modules/rendering/types/VideoFrameSource';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { profiler } from '@modules/profiling/Profiler';

/** One frame of the resident group, under the time it answers to. */
export interface HeldFrame {
  readonly time: number;
  readonly frame: DecodedVideoFrame;
}

/**
 * `VideoFrameSource` over a resident group of frames. {@link hold}
 * publishes the group and the times it answers to; {@link getFrameAt}
 * serves any of them and nothing else. Querying a time outside the
 * resident group throws.
 *
 * Holding several at once is what lets a batch of caption tiles cover
 * several frames: every tile in the batch pulls its own frame while
 * the batch renders.
 */
export class BufferedVideoFrameSource implements VideoFrameSource {

  // Any mismatch beyond IEEE-754 noise is a coordination bug between
  // the producer and the subtitle renderer.
  private static readonly TIMESTAMP_TOLERANCE_S = 1e-6;

  private held: ReadonlyArray<HeldFrame> = [];

  /**
   * @param withAlpha Encodes frames as PNG, keeping their transparency, instead of as opaque JPEG.
   */
  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly withAlpha: boolean,
  ) {}

  /**
   * Makes `frames` the only ones {@link getFrameAt} will serve, each
   * under its paired time, until the next call. Does not take ownership:
   * the frames must stay usable until then and are closed by whoever
   * produced them.
   */
  hold(frames: ReadonlyArray<HeldFrame>): void {
    this.held = frames;
  }

  async getFrameAt(timeSeconds: number, jpegQuality: number, region?: VideoFrameRegion): Promise<string> {
    const frame = this.frameAt(timeSeconds);
    return profiler.time('BufferedVideoFrameSource.encode', () =>
      this.encode(frame, region, jpegQuality),
    );
  }

  private frameAt(timeSeconds: number): DecodedVideoFrame {
    const match = this.held.find(
      (candidate) => Math.abs(candidate.time - timeSeconds) <= BufferedVideoFrameSource.TIMESTAMP_TOLERANCE_S,
    );
    if (!match) {
      const times = this.held.map((candidate) => candidate.time).join(', ');
      throw new Error(
        `BufferedVideoFrameSource: requested time ${timeSeconds}, but the resident group holds [${times}].`,
      );
    }
    return match.frame;
  }

  private encode(
    frame: DecodedVideoFrame,
    region: VideoFrameRegion | undefined,
    jpegQuality: number,
  ): string {
    const clipped = region ? this.clipToFrame(region) : null;
    if (!clipped || clipped.width === 0 || clipped.height === 0) {
      return this.encodeImage(this.drawInto(frame, { x: 0, y: 0, width: this.width, height: this.height }), jpegQuality);
    }
    return this.encodeImage(this.drawInto(frame, clipped), jpegQuality);
  }

  /**
   * Draws `region` of the frame onto a canvas sized to that region,
   * which is what the image is then encoded from. Drawing straight from
   * the frame rather than from a full-size copy of it is one fewer trip
   * through the pixels per tile.
   */
  private drawInto(frame: DecodedVideoFrame, region: VideoFrameRegion): HTMLCanvasElement {
    const canvas = this.createCanvas(region.width, region.height);
    const context = profiler.time('BufferedVideoFrameSource.cropCanvasContext', () =>
      canvas.getContext('2d', { alpha: this.withAlpha }),
    );
    if (!context) {
      throw new Error('Canvas 2D context is not available for cropping.');
    }
    profiler.time('BufferedVideoFrameSource.cropDraw', () =>
      frame.draw(context, -region.x, -region.y, this.width, this.height),
    );
    return canvas;
  }

  // Chosen for predictability over raw speed. `toDataURL` encodes inline;
  // `OffscreenCanvas.convertToBlob` defers to the browser's async image
  // scheduler, which was measured taking ~1s per call instead of the usual
  // few ms, under a load that could not be pinned down or reproduced.
  // Output is byte-identical between the two on Chrome and Firefox, and the
  // async overhead is per-call rather than per-pixel, so the two only differ
  // meaningfully at small crop sizes. The tradeoff accepted here is that
  // encoding inline blocks the main thread for the whole encode, and that a
  // DOM canvas rules out ever running this step in a Worker.
  // Benchmarked in experiments/jpeg-encode-apis/.
  // PNG rather than WebP for alpha: WebP measured 6-10x slower than JPEG, while
  // PNG of a mostly transparent frame, the only kind with alpha here, beat JPEG.
  private encodeImage(canvas: HTMLCanvasElement, quality: number): string {
    return profiler.time('BufferedVideoFrameSource.encodeImage', () =>
      canvas.toDataURL(this.withAlpha ? 'image/png' : 'image/jpeg', quality),
    );
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private clipToFrame(region: VideoFrameRegion): VideoFrameRegion {
    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const right = Math.min(this.width, Math.ceil(region.x + region.width));
    const bottom = Math.min(this.height, Math.ceil(region.y + region.height));
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  }
}
