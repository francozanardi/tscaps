import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { FramingSheetComposer, LabelledPicture } from '@core/reframe/domain/FramingSheetComposer';
import type { PictureCrop } from '@core/reframe/domain/PictureCrop';
import type { HeadMark, MarkedPicture, SurveySheetComposer } from '@core/reframe/domain/SurveySheetComposer';

/** Where a picture is drawn on the sheet, and the part of its bitmap drawn there, in pixels. */
interface Placement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const GAP_PX = 6;
const JPEG_QUALITY = 0.85;
const LABEL_FONT = '700 22px system-ui, sans-serif';
const LABEL_PADDING_PX = 5;
const LABEL_HEIGHT_PX = 30;
const MARK_COLOUR = '#ffe14a';
const MARK_LINE_PX = 3;
// A head's box is this wide for its height, and never smaller than this, so a far person's mark still shows.
const MARK_WIDTH_OF_HEIGHT = 0.85;
const MIN_MARK_PX = 16;
const RULER_HEIGHT_PX = 16;
const RULER_FONT = '700 11px system-ui, sans-serif';
const RULER_TENTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Draws framing sheets on an `OffscreenCanvas` as JPEG: crops of pictures
 * laid out by moment and by candidate, or pictures in a grid, each with
 * its label in a dark box on its top left corner, where it reads on any
 * picture; and whole pictures with the people in them boxed and
 * lettered over a ruler of the picture's width.
 */
export class CanvasFramingSheetComposer implements FramingSheetComposer, SurveySheetComposer {
  async crops(
    pictures: ReadonlyArray<ImageBitmap>,
    crops: ReadonlyArray<PictureCrop>,
    letters: ReadonlyArray<string>,
    cellHeightPx: number,
  ): Promise<EncodedPicture> {
    const first = pictures[0];
    const shape = crops[0];
    if (first === undefined || shape === undefined) throw new Error('A framing sheet needs a picture and a crop');
    const cellWidthPx = Math.round(cellHeightPx * (shape.width * first.width) / (shape.height * first.height));
    const { canvas, context } = this.canvasOf(crops.length * (cellWidthPx + GAP_PX) - GAP_PX, pictures.length * (cellHeightPx + GAP_PX) - GAP_PX);
    pictures.forEach((picture, row) => {
      crops.forEach((crop, column) => {
        const cell = { x: column * (cellWidthPx + GAP_PX), y: row * (cellHeightPx + GAP_PX), width: cellWidthPx, height: cellHeightPx };
        this.draw(context, picture, this.sourceOf(picture, crop), cell);
        this.label(context, letters[column] ?? '', cell);
      });
    });
    return this.encoded(canvas);
  }

  async grid(pictures: ReadonlyArray<LabelledPicture>, columns: number, cellWidthPx: number): Promise<EncodedPicture> {
    const first = pictures[0];
    if (first === undefined) throw new Error('A framing sheet needs a picture');
    const cellHeightPx = Math.round(cellWidthPx * first.bitmap.height / first.bitmap.width);
    const used = Math.min(columns, pictures.length);
    const rows = Math.ceil(pictures.length / used);
    const { canvas, context } = this.canvasOf(used * (cellWidthPx + GAP_PX) - GAP_PX, rows * (cellHeightPx + GAP_PX) - GAP_PX);
    pictures.forEach((picture, index) => {
      const cell = { x: (index % used) * (cellWidthPx + GAP_PX), y: Math.floor(index / used) * (cellHeightPx + GAP_PX), width: cellWidthPx, height: cellHeightPx };
      this.draw(context, picture.bitmap, { x: 0, y: 0, width: picture.bitmap.width, height: picture.bitmap.height }, cell);
      this.label(context, picture.label, cell);
    });
    return this.encoded(canvas);
  }

  async survey(pictures: ReadonlyArray<MarkedPicture>, columns: number, cellWidthPx: number): Promise<EncodedPicture> {
    const first = pictures[0];
    if (first === undefined) throw new Error('A survey sheet needs a picture');
    const cellHeightPx = Math.round(cellWidthPx * first.bitmap.height / first.bitmap.width);
    const used = Math.min(columns, pictures.length);
    const rows = Math.ceil(pictures.length / used);
    const { canvas, context } = this.canvasOf(used * (cellWidthPx + GAP_PX) - GAP_PX, rows * (cellHeightPx + GAP_PX) - GAP_PX);
    pictures.forEach((picture, index) => {
      const cell = { x: (index % used) * (cellWidthPx + GAP_PX), y: Math.floor(index / used) * (cellHeightPx + GAP_PX), width: cellWidthPx, height: cellHeightPx };
      this.draw(context, picture.bitmap, { x: 0, y: 0, width: picture.bitmap.width, height: picture.bitmap.height }, cell);
      this.ruler(context, cell);
      for (const mark of picture.marks) this.mark(context, mark, cell);
      this.label(context, picture.label, cell);
    });
    return this.encoded(canvas);
  }

  /** A box around a head and its letter above it, or below where the head is at the top of the picture. */
  private mark(context: OffscreenCanvasRenderingContext2D, mark: HeadMark, cell: Placement): void {
    const height = Math.max(MIN_MARK_PX, mark.headHeight * cell.height);
    const width = Math.max(MIN_MARK_PX, height * MARK_WIDTH_OF_HEIGHT);
    const left = cell.x + mark.head.x * cell.width - width / 2;
    const top = cell.y + mark.head.y * cell.height - height / 2;
    context.lineWidth = MARK_LINE_PX;
    context.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    context.strokeRect(left - 1, top - 1, width + 2, height + 2);
    context.strokeStyle = MARK_COLOUR;
    context.strokeRect(left, top, width, height);
    context.font = LABEL_FONT;
    const labelWidth = context.measureText(mark.letter).width + LABEL_PADDING_PX * 2;
    const above = top - LABEL_HEIGHT_PX - 2 >= cell.y;
    const labelLeft = Math.min(cell.x + cell.width - labelWidth, Math.max(cell.x, left + width / 2 - labelWidth / 2));
    const labelTop = above ? top - LABEL_HEIGHT_PX - 2 : top + height + 2;
    context.fillStyle = 'rgba(0, 0, 0, 0.72)';
    context.fillRect(labelLeft, labelTop, labelWidth, LABEL_HEIGHT_PX);
    context.fillStyle = MARK_COLOUR;
    context.textBaseline = 'middle';
    context.fillText(mark.letter, labelLeft + LABEL_PADDING_PX, labelTop + LABEL_HEIGHT_PX / 2);
  }

  /** A band along the cell's bottom edge with a tick and a digit at every tenth of its width. */
  private ruler(context: OffscreenCanvasRenderingContext2D, cell: Placement): void {
    const top = cell.y + cell.height - RULER_HEIGHT_PX;
    context.fillStyle = 'rgba(0, 0, 0, 0.72)';
    context.fillRect(cell.x, top, cell.width, RULER_HEIGHT_PX);
    context.font = RULER_FONT;
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    for (const tenth of RULER_TENTHS) {
      const x = cell.x + (tenth / 10) * cell.width;
      context.fillRect(x - 0.5, top, 1, RULER_HEIGHT_PX / 3);
      const digit = String(tenth);
      context.fillText(digit, x - context.measureText(digit).width / 2, top + RULER_HEIGHT_PX * 0.62);
    }
  }

  private canvasOf(width: number, height: number): { canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D } {
    const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D context for the framing sheet');
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas, context };
  }

  /** The part of `picture` a crop names, in its pixels, kept inside it. */
  private sourceOf(picture: ImageBitmap, crop: PictureCrop): Placement {
    const x = Math.max(0, Math.round(crop.left * picture.width));
    const y = Math.max(0, Math.round(crop.top * picture.height));
    return {
      x,
      y,
      width: Math.max(1, Math.min(picture.width - x, Math.round(crop.width * picture.width))),
      height: Math.max(1, Math.min(picture.height - y, Math.round(crop.height * picture.height))),
    };
  }

  private draw(context: OffscreenCanvasRenderingContext2D, picture: ImageBitmap, source: Placement, cell: Placement): void {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(picture, source.x, source.y, source.width, source.height, cell.x, cell.y, cell.width, cell.height);
  }

  private label(context: OffscreenCanvasRenderingContext2D, text: string, cell: Placement): void {
    if (text === '') return;
    context.font = LABEL_FONT;
    const width = context.measureText(text).width + LABEL_PADDING_PX * 2;
    context.fillStyle = 'rgba(0, 0, 0, 0.72)';
    context.fillRect(cell.x + 4, cell.y + 4, width, LABEL_HEIGHT_PX);
    context.fillStyle = '#ffe14a';
    context.textBaseline = 'middle';
    context.fillText(text, cell.x + 4 + LABEL_PADDING_PX, cell.y + 4 + LABEL_HEIGHT_PX / 2);
  }

  private async encoded(canvas: OffscreenCanvas): Promise<EncodedPicture> {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    return { mediaType: 'image/jpeg', base64: await this.base64Of(blob), widthPx: canvas.width, heightPx: canvas.height };
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
