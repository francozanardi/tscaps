import type { FramePainter } from '@core/preview/domain/FramePainter';
import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';

/**
 * Paints decoded video frames onto a canvas with `contain`
 * fitting. Owns the canvas's intrinsic size so layout follows
 * the source video's aspect ratio.
 *
 * For sources above the preview resolution cap the canvas is
 * sized to the capped dimensions so each draw stays cheap on the
 * main thread. The decoded frame is scaled at paint time — the
 * preview is visually equivalent on a typical display while the
 * export pipeline keeps the original resolution.
 *
 * The active canvas may be swapped at runtime via {@link setCanvas}
 * without losing the previously configured intrinsic size: the new
 * canvas inherits the same width/height so the next paint draws
 * uninterrupted.
 */
export class CanvasFramePainter implements FramePainter {

  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private intrinsicWidthPx = 0;
  private intrinsicHeightPx = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly resolutionCap: PreviewResolutionCap,
  ) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    if (canvas === this.canvas) return;
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    if (this.intrinsicWidthPx > 0 && this.intrinsicHeightPx > 0) {
      this.applyIntrinsicSize(this.intrinsicWidthPx, this.intrinsicHeightPx);
    }
  }

  setIntrinsicSize(widthPx: number, heightPx: number): void {
    const target = this.resolutionCap.clamp(widthPx, heightPx);
    this.intrinsicWidthPx = target.widthPx;
    this.intrinsicHeightPx = target.heightPx;
    this.applyIntrinsicSize(target.widthPx, target.heightPx);
  }

  paint(frame: PreviewVideoFrame): void {
    if (!this.context) return;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    if (canvasWidth === 0 || canvasHeight === 0) return;
    if (frame.widthPx === 0 || frame.heightPx === 0) return;
    const scale = Math.min(canvasWidth / frame.widthPx, canvasHeight / frame.heightPx);
    const drawWidth = frame.widthPx * scale;
    const drawHeight = frame.heightPx * scale;
    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;
    this.context.clearRect(0, 0, canvasWidth, canvasHeight);
    this.context.drawImage(frame.bitmap, drawX, drawY, drawWidth, drawHeight);
  }

  clear(): void {
    if (!this.context) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private applyIntrinsicSize(widthPx: number, heightPx: number): void {
    if (this.canvas.width !== widthPx) this.canvas.width = widthPx;
    if (this.canvas.height !== heightPx) this.canvas.height = heightPx;
  }
}
