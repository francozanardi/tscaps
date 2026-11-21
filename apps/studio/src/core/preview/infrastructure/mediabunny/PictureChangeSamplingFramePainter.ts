import type {
  FramePainter,
  FramePaintRequest,
  PaintFrame,
} from '@tscaps/engine/advanced';
import type { PictureChangeDetector } from '@core/preview/services/PictureChangeDetector';

/**
 * Paints as the painter it wraps does, and on the way hands a small
 * thumbnail of every source frame to a {@link PictureChangeDetector}, so
 * a pass that decodes every frame anyway finds where the picture
 * changes for little more than it already costs.
 *
 * Thumbnails are drawn side by side into one sheet and read back a
 * sheet at a time: reading pixels back waits for the GPU, and once per
 * sheet keeps that wait off nearly every frame.
 *
 * Where the runtime has no `OffscreenCanvas`, or the run painted no
 * frame, nothing is sampled, and {@link pictureChanges} answers `null`.
 */
export class PictureChangeSamplingFramePainter implements FramePainter {
  private static readonly THUMBNAIL_SIZE_PX = 32;
  private static readonly SHEET_COLUMNS = 16;
  private static readonly SHEET_ROWS = 8;

  private sheet: OffscreenCanvasRenderingContext2D | null = null;
  private pendingTimestampsSec: number[] = [];
  private sampledFrames = 0;

  constructor(
    private readonly inner: FramePainter,
    private readonly detector: PictureChangeDetector,
  ) {}

  async begin(width: number, height: number, fps: number, sourceWidth: number, sourceHeight: number): Promise<void> {
    this.sheet = this.openSheet();
    await this.inner.begin(width, height, fps, sourceWidth, sourceHeight);
  }

  lookAhead(): number {
    return this.inner.lookAhead();
  }

  async paint(requests: ReadonlyArray<FramePaintRequest>): Promise<PaintFrame[]> {
    for (const request of requests) this.sample(request);
    return this.inner.paint(requests);
  }

  /** Reads back the thumbnails still waiting on the sheet, then closes the wrapped painter. */
  end(): void {
    this.readSheet();
    this.sheet = null;
    this.inner.end();
  }

  /**
   * Where the picture changed over the frames painted, in source
   * seconds, ascending; `null` where nothing could be sampled. Read it
   * once the run has ended.
   */
  pictureChanges(): number[] | null {
    return this.sampledFrames > 0 ? this.detector.changes() : null;
  }

  private openSheet(): OffscreenCanvasRenderingContext2D | null {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const size = PictureChangeSamplingFramePainter.THUMBNAIL_SIZE_PX;
    const canvas = new OffscreenCanvas(
      size * PictureChangeSamplingFramePainter.SHEET_COLUMNS,
      size * PictureChangeSamplingFramePainter.SHEET_ROWS,
    );
    return canvas.getContext('2d');
  }

  private sample(request: FramePaintRequest): void {
    if (!this.sheet) return;
    const slot = this.pendingTimestampsSec.length;
    const size = PictureChangeSamplingFramePainter.THUMBNAIL_SIZE_PX;
    const columns = PictureChangeSamplingFramePainter.SHEET_COLUMNS;
    request.frame.draw(this.sheet, (slot % columns) * size, Math.floor(slot / columns) * size, size, size);
    this.pendingTimestampsSec.push(request.frame.timestamp);
    this.sampledFrames += 1;
    if (this.pendingTimestampsSec.length === columns * PictureChangeSamplingFramePainter.SHEET_ROWS) this.readSheet();
  }

  private readSheet(): void {
    if (!this.sheet || this.pendingTimestampsSec.length === 0) return;
    const size = PictureChangeSamplingFramePainter.THUMBNAIL_SIZE_PX;
    const columns = PictureChangeSamplingFramePainter.SHEET_COLUMNS;
    const pixels = this.sheet.getImageData(0, 0, this.sheet.canvas.width, this.sheet.canvas.height);
    this.pendingTimestampsSec.forEach((timestampSec, slot) => {
      this.detector.observe(timestampSec, this.thumbnailAt(pixels, (slot % columns) * size, Math.floor(slot / columns) * size));
    });
    this.pendingTimestampsSec = [];
  }

  private thumbnailAt(sheet: ImageData, left: number, top: number): Uint8ClampedArray {
    const size = PictureChangeSamplingFramePainter.THUMBNAIL_SIZE_PX;
    const thumbnail = new Uint8ClampedArray(size * size * 4);
    for (let row = 0; row < size; row += 1) {
      const from = ((top + row) * sheet.width + left) * 4;
      thumbnail.set(sheet.data.subarray(from, from + size * 4), row * size * 4);
    }
    return thumbnail;
  }
}
