import type { FootagePicture } from '@tscaps/engine/advanced';
import type { FramePainter } from '@core/preview/domain/FramePainter';
import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { HeldFootagePicture } from '@core/preview/infrastructure/footage/FootagePlayer';

/**
 * Keeps the last frame painted onto a canvas of its own, at the frame's
 * own size, so the picture outlives the frame — which its pump closes
 * right after painting — and can be drawn again on every composition.
 */
export class CanvasFootageFrameHolder implements FramePainter, FootagePicture {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private painted = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
  }

  /** Nothing to size ahead: the canvas takes each frame's own size as it lands. */
  setIntrinsicSize(): void {}

  paint(frame: PreviewVideoFrame): void {
    if (!this.context || frame.widthPx === 0 || frame.heightPx === 0) return;
    if (this.canvas.width !== frame.widthPx) this.canvas.width = frame.widthPx;
    if (this.canvas.height !== frame.heightPx) this.canvas.height = frame.heightPx;
    this.context.drawImage(frame.bitmap, 0, 0, frame.widthPx, frame.heightPx);
    this.painted = true;
  }

  clear(): void {
    this.painted = false;
  }

  /** The frame painted last, or null before the first or after {@link clear}. */
  held(): HeldFootagePicture | null {
    return this.painted ? { picture: this, width: this.canvas.width, height: this.canvas.height } : null;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    context.drawImage(this.canvas, dx, dy, dWidth, dHeight);
  }

  /** Hands the pixels back at once instead of waiting for a collection. */
  release(): void {
    this.painted = false;
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
