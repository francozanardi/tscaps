import type { EncodedPicture, LabeledPicture, PictureBackdrop, PictureRegion, PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';

const LABEL_HEIGHT_PX = 22;
const GAP_PX = 6;
const JPEG_QUALITY = 0.82;
const CHECKER_SQUARE_PX = 12;
// Shapes this close are one shape: frames of one video differ by a rounding pixel at most.
const SAME_SHAPE_TOLERANCE = 0.01;

/** Where each picture goes in the sheet, and the sheet's size. */
interface SheetLayout {
  readonly columns: number;
  readonly cellWidthPx: number;
  readonly cellHeightPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Composes pictures into one JPEG on an `OffscreenCanvas`: a grid of as
 * many columns as fit the pictures' shape (four tall frames side by side,
 * two wide ones; square cells when their shapes differ), each picture
 * fitted whole and centred in its cell, never stretched, its label in a
 * strip under it, transparent parts over a checkerboard when asked.
 */
export class CanvasPictureSheetComposer implements PictureSheetComposer {
  async sheet(
    pictures: ReadonlyArray<LabeledPicture>,
    options: { readonly maxWidthPx: number; readonly maxHeightPx: number; readonly region: PictureRegion | null; readonly backdrop: PictureBackdrop },
  ): Promise<EncodedPicture> {
    if (pictures.length === 0) throw new Error('A picture sheet needs at least one picture');
    const shared = this.sharedAspectOf(pictures, options.region);
    const layout = shared === null
      ? this.largestSquareLayoutOf(pictures.length, options.maxWidthPx, options.maxHeightPx)
      : this.layoutOf(pictures.length, shared, shared < 1 ? 4 : 2, options.maxWidthPx, options.maxHeightPx);
    const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D context for the picture sheet');
    context.fillStyle = '#111318';
    context.fillRect(0, 0, layout.widthPx, layout.heightPx);
    pictures.forEach((picture, index) => this.drawCell(context, picture, index, layout, options.region, options.backdrop));
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    return { mediaType: 'image/jpeg', base64: await this.base64Of(blob), widthPx: layout.widthPx, heightPx: layout.heightPx };
  }

  /** The shape every picture shares, or null when their shapes differ. */
  private sharedAspectOf(pictures: ReadonlyArray<LabeledPicture>, region: PictureRegion | null): number | null {
    const aspects = pictures.map((picture) => {
      const source = this.sourceRect(picture.bitmap, region);
      return source.width / source.height;
    });
    const first = aspects[0]!;
    return aspects.every((aspect) => Math.abs(aspect - first) / first < SAME_SHAPE_TOLERANCE) ? first : null;
  }

  /** Square cells, in as many columns as make them largest: pictures of different shapes each fit one whole. */
  private largestSquareLayoutOf(count: number, maxWidthPx: number, maxHeightPx: number): SheetLayout {
    let best = this.layoutOf(count, 1, 1, maxWidthPx, maxHeightPx);
    for (let columns = 2; columns <= count; columns += 1) {
      const layout = this.layoutOf(count, 1, columns, maxWidthPx, maxHeightPx);
      if (layout.cellWidthPx > best.cellWidthPx) best = layout;
    }
    return best;
  }

  private layoutOf(count: number, aspect: number, preferredColumns: number, maxWidthPx: number, maxHeightPx: number): SheetLayout {
    const columns = Math.min(count, preferredColumns);
    const rows = Math.ceil(count / columns);
    const widthFromWidth = (maxWidthPx - GAP_PX * (columns - 1)) / columns;
    const widthFromHeight = ((maxHeightPx - GAP_PX * (rows - 1)) / rows - LABEL_HEIGHT_PX) * aspect;
    const cellWidthPx = Math.max(32, Math.floor(Math.min(widthFromWidth, widthFromHeight)));
    const cellHeightPx = Math.round(cellWidthPx / aspect);
    return {
      columns,
      cellWidthPx,
      cellHeightPx,
      widthPx: columns * cellWidthPx + GAP_PX * (columns - 1),
      heightPx: rows * (cellHeightPx + LABEL_HEIGHT_PX) + GAP_PX * (rows - 1),
    };
  }

  private drawCell(
    context: OffscreenCanvasRenderingContext2D,
    picture: LabeledPicture,
    index: number,
    layout: SheetLayout,
    region: PictureRegion | null,
    backdrop: PictureBackdrop,
  ): void {
    const x = (index % layout.columns) * (layout.cellWidthPx + GAP_PX);
    const y = Math.floor(index / layout.columns) * (layout.cellHeightPx + LABEL_HEIGHT_PX + GAP_PX);
    const source = this.sourceRect(picture.bitmap, region);
    const scale = Math.min(layout.cellWidthPx / source.width, layout.cellHeightPx / source.height);
    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);
    const left = x + Math.floor((layout.cellWidthPx - width) / 2);
    const top = y + Math.floor((layout.cellHeightPx - height) / 2);
    if (backdrop === 'checker') this.drawChecker(context, left, top, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(picture.bitmap, source.x, source.y, source.width, source.height, left, top, width, height);
    context.fillStyle = '#f2f2f4';
    context.font = '600 14px system-ui, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(picture.label, x + 6, y + layout.cellHeightPx + LABEL_HEIGHT_PX / 2, layout.cellWidthPx - 12);
  }

  private drawChecker(context: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    for (let row = 0; row * CHECKER_SQUARE_PX < height; row += 1) {
      for (let column = 0; column * CHECKER_SQUARE_PX < width; column += 1) {
        context.fillStyle = (row + column) % 2 === 0 ? '#5a5d66' : '#3c3f47';
        context.fillRect(
          x + column * CHECKER_SQUARE_PX,
          y + row * CHECKER_SQUARE_PX,
          Math.min(CHECKER_SQUARE_PX, width - column * CHECKER_SQUARE_PX),
          Math.min(CHECKER_SQUARE_PX, height - row * CHECKER_SQUARE_PX),
        );
      }
    }
  }

  private sourceRect(bitmap: ImageBitmap, region: PictureRegion | null): { x: number; y: number; width: number; height: number } {
    if (region === null) return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const x = Math.round(Math.min(Math.max(region.x, 0), 1) * bitmap.width);
    const y = Math.round(Math.min(Math.max(region.y, 0), 1) * bitmap.height);
    const width = Math.max(1, Math.min(bitmap.width - x, Math.round(region.width * bitmap.width)));
    const height = Math.max(1, Math.min(bitmap.height - y, Math.round(region.height * bitmap.height)));
    return { x, y, width, height };
  }

  private async base64Of(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }
}
