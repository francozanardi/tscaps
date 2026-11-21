import type { FootageGrade } from '@modules/video/grade/FootageGrade';
import type { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';
import type { FootageGrader } from '@modules/video/grade/FootageGrader';

/**
 * {@link FootageGrader} on a 2D canvas alone, for a browser without
 * WebGL2: an approximation of the same terms. The exposure and the white
 * balance multiply the picture by their gain colour, the contrast and
 * the saturation are the canvas's own `contrast()` and `saturate()`
 * filters, and the vignette is a radial shade drawn over it. Where the
 * canvas cannot filter, the contrast and the saturation are left out.
 */
export class CanvasFilterFootageGrader implements FootageGrader {
  constructor(private readonly math: FootageGradeMath) {}

  grade(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    grade: FootageGrade,
  ): void {
    if (!(width > 0 && height > 0) || this.math.isNeutral(grade)) return;
    const terms = this.math.termsOf(grade);
    this.applyGain(context, width, height, terms.gain);
    this.applyFilters(context, width, height, terms.contrast, terms.saturation);
    this.applyVignette(context, width, height, terms.vignette, terms.vignetteStart);
  }

  /** Multiplies each channel by its gain: below one by a multiply, above one by an additive lighten of the same picture. */
  private applyGain(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    gain: readonly [number, number, number],
  ): void {
    const darkening = gain.map((value) => Math.min(1, value));
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = `rgb(${darkening.map((value) => Math.round(value * 255)).join(', ')})`;
    context.fillRect(0, 0, width, height);
    const brightening = gain.map((value) => Math.max(0, value - 1));
    if (brightening.some((value) => value > 0)) {
      const copy = this.copyOf(context, width, height);
      if (copy !== null) {
        context.globalCompositeOperation = 'lighter';
        const tinted = copy.getContext('2d')!;
        tinted.globalCompositeOperation = 'multiply';
        tinted.fillStyle = `rgb(${brightening.map((value) => Math.round(Math.min(1, value) * 255)).join(', ')})`;
        tinted.fillRect(0, 0, width, height);
        context.drawImage(copy, 0, 0);
      }
    }
    context.restore();
  }

  private applyFilters(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    contrast: number,
    saturation: number,
  ): void {
    if (contrast === 1 && saturation === 1) return;
    const copy = this.copyOf(context, width, height);
    if (copy === null) return;
    context.save();
    context.globalCompositeOperation = 'copy';
    context.filter = `contrast(${contrast}) saturate(${saturation})`;
    context.drawImage(copy, 0, 0);
    context.restore();
  }

  private applyVignette(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    vignette: number,
    start: number,
  ): void {
    if (vignette <= 0) return;
    const reach = Math.hypot(width, height) / 2;
    const shade = context.createRadialGradient(width / 2, height / 2, reach * start, width / 2, height / 2, reach);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, `rgba(0, 0, 0, ${vignette})`);
    context.save();
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  private copyOf(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
  ): OffscreenCanvas | null {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const copy = new OffscreenCanvas(width, height);
    const copyContext = copy.getContext('2d');
    if (copyContext === null) return null;
    copyContext.drawImage(context.canvas, 0, 0);
    return copy;
  }
}
