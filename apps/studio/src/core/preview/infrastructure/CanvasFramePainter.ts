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
 */
export class CanvasFramePainter implements FramePainter {

  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly resolutionCap: PreviewResolutionCap,
  ) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
  }

  setIntrinsicSize(widthPx: number, heightPx: number): void {
    const target = this.resolutionCap.clamp(widthPx, heightPx);
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
