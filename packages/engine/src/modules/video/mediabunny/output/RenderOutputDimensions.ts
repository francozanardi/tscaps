/** A size in pixels. */
export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The size a render paints its frames at: the output frame's own size,
 * or the size asked for, never larger than the frame on either axis and
 * snapped to even numbers on both, which most hardware video encoders
 * require. Keeping the frame's aspect ratio is the asker's job: nothing
 * here letterboxes or crops.
 */
export class RenderOutputDimensions {

  /** `frame` as it is when nothing smaller is `requested`. */
  resolve(frame: PixelSize, requested: PixelSize | undefined): PixelSize {
    if (!requested) return { width: frame.width, height: frame.height };
    const width = Math.min(requested.width, frame.width);
    const height = Math.min(requested.height, frame.height);
    return { width: this.toEven(width), height: this.toEven(height) };
  }

  private toEven(value: number): number {
    const rounded = Math.round(value);
    return rounded % 2 === 0 ? rounded : rounded - 1;
  }
}
