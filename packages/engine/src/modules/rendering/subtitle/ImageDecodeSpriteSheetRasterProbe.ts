import type {
  SpriteSheetRasterOutcome,
  SpriteSheetRasterProbe,
} from '@modules/rendering/subtitle/SpriteSheetRasterProbe';

const MARKER_SIZE_PX = 2;
const PATCH_WIDTH_PX = 64;
const PATCH_HEIGHT_PX = 32;
/** Largest channel difference between the two patches still read as the same paint. */
const PATCH_TOLERANCE = 48;

/**
 * Draws a data-URL SVG through an `<img>` onto a canvas, the same
 * delivery path a real sprite sheet takes, and reads its far corner
 * back.
 *
 * The readback is the point: some hosts decode an oversize SVG and
 * report success while leaving the far edges unpainted. Nothing public
 * answers this instead — the reported WebGL limits (`MAX_TEXTURE_SIZE`,
 * `MAX_VIEWPORT_DIMS`) bear no stable relation to what `img.decode` and
 * `drawImage` accept.
 *
 * A far corner that is painted can still be painted wrong. Firefox
 * draws a blurred `text-shadow` that sits beside a `filter`ed sibling as
 * a solid box once it lies past about 8192 px into the SVG, while plain
 * fills there come out right. So the raster also carries one patch of
 * that markup twice, at the origin and at the far edge, and the two
 * must read back alike.
 */
export class ImageDecodeSpriteSheetRasterProbe implements SpriteSheetRasterProbe {

  async offer(width: number, height: number): Promise<SpriteSheetRasterOutcome> {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.markerSvg(width, height))}`;
    try {
      await image.decode();
      const context = new OffscreenCanvas(width, height).getContext('2d');
      if (!context) return { refusal: 'no-context' };
      context.drawImage(image, 0, 0);
      const corner = context.getImageData(width - 1, height - 1, 1, 1).data;
      if (!this.isMarker(corner)) return { refusal: 'blank-edge' };
      return this.patchesMatch(context, width, height) ? { refusal: null } : { refusal: 'distorted-edge' };
    } catch (cause) {
      return { refusal: 'error', cause };
    }
  }

  private markerSvg(width: number, height: number): string {
    const x = width - MARKER_SIZE_PX;
    const y = height - MARKER_SIZE_PX;
    const farPatch = this.farPatchOrigin(width, height);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
      + `<rect width="100%" height="100%" fill="green"/>`
      + this.patch(0, 0)
      + this.patch(farPatch.x, farPatch.y)
      + `<rect x="${x}" y="${y}" width="${MARKER_SIZE_PX}" height="${MARKER_SIZE_PX}" fill="red"/>`
      + `</svg>`;
  }

  /** Text with a blurred shadow over a blurred sibling, the pair Firefox mispaints far from the origin. */
  private patch(x: number, y: number): string {
    return `<foreignObject x="${x}" y="${y}" width="${PATCH_WIDTH_PX}" height="${PATCH_HEIGHT_PX}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${PATCH_WIDTH_PX}px;height:${PATCH_HEIGHT_PX}px;font:12px sans-serif;color:#fff;">`
      + `<div style="position:absolute;inset:0;filter:blur(1px);background:#f00;"></div>`
      + `<span style="position:relative;text-shadow:0 0 3px rgba(0,0,0,0.55);">ab</span>`
      + `</div></foreignObject>`;
  }

  /** Where the far patch starts: in the far corner, clear of the marker, and never over the origin patch. */
  private farPatchOrigin(width: number, height: number): { x: number; y: number } {
    return {
      x: Math.max(0, width - MARKER_SIZE_PX - PATCH_WIDTH_PX),
      y: Math.max(PATCH_HEIGHT_PX, height - PATCH_HEIGHT_PX),
    };
  }

  private patchesMatch(context: OffscreenCanvasRenderingContext2D, width: number, height: number): boolean {
    const far = this.farPatchOrigin(width, height);
    if (far.y + PATCH_HEIGHT_PX > height) return true;
    const reference = context.getImageData(0, 0, PATCH_WIDTH_PX, PATCH_HEIGHT_PX).data;
    const distant = context.getImageData(far.x, far.y, PATCH_WIDTH_PX, PATCH_HEIGHT_PX).data;
    for (let i = 0; i < reference.length; i++) {
      if (Math.abs(reference[i]! - distant[i]!) > PATCH_TOLERANCE) return false;
    }
    return true;
  }

  private isMarker(pixel: Uint8ClampedArray): boolean {
    return pixel[0]! > 200 && pixel[1]! < 80 && pixel[2]! < 80 && pixel[3]! > 200;
  }
}
