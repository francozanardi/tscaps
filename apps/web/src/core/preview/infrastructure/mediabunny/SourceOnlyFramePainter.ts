import type {
  DecodedVideoFrame,
  FramePainter,
  PaintFrame,
} from '@tscaps/engine';

/**
 * Paints every output frame as the raw source frame, resized to the
 * target dimensions via 2D canvas resampling. No captions, no overlay,
 * no compositing — this is what the preview proxy pipeline wants when
 * it just needs a downscaled, normalized copy of the input.
 */
export class SourceOnlyFramePainter implements FramePainter {

  private width = 0;
  private height = 0;

  async begin(width: number, height: number, _fps: number): Promise<void> {
    this.width = width;
    this.height = height;
  }

  async paint(frame: DecodedVideoFrame, _outputTimestamp: number): Promise<PaintFrame> {
    return (ctx) => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      frame.draw(ctx, 0, 0, this.width, this.height);
    };
  }

  end(): void {}
}
