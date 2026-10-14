import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * A decoded frame with the frame-invariant overlay already painted over
 * it: the picture the captions are composited onto, as opposed to the
 * picture the decoder produced.
 *
 * It is what a caption that samples the video has to be handed. A
 * caption that paints the frame inside its own raster — as a backdrop
 * to blend against, or as a layer of its own style — puts those pixels
 * back on top of the overlay when its raster is composited. Handed the
 * bare frame, it erases the overlay wherever it paints, which for a
 * watermark is the whole point of the overlay gone.
 *
 * Does not own either part: closing it closes nothing, and both must
 * stay usable for as long as it is drawn.
 */
export class OverlaidVideoFrame implements DecodedVideoFrame {

  constructor(
    private readonly frame: DecodedVideoFrame,
    private readonly overlay: OverlayFrame,
  ) {}

  get timestamp(): number {
    return this.frame.timestamp;
  }

  get duration(): number {
    return this.frame.duration;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    this.frame.draw(context, dx, dy, dWidth, dHeight);
    this.overlay.draw(context, dx, dy, dWidth, dHeight);
  }

  /** The parts belong to whoever produced them. */
  close(): void {}
}
