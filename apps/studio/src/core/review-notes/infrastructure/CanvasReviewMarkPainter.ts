import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewMarkedPlace, ReviewMarkPainter } from '@core/review-notes/domain/ReviewMarkPainter';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

// The editor's accent, so a note looks the same in the picture as it did on the preview.
const INK = '#5B7BE6';
const HALO = 'rgba(0, 0, 0, 0.55)';
const LABEL_TEXT = '#ffffff';
/** Line width as a share of the frame's shorter side, so a mark reads the same on any frame. */
const LINE_SHARE = 0.008;
const HALO_SHARE = 0.006;
const LABEL_RADIUS_SHARE = 0.032;
const POINT_RING_SHARE = 0.018;

/**
 * Paints notes' marks on a 2D canvas the size of the frame, in one
 * bright ink over a dark halo so they read over any picture, and each
 * note's number in a disc beside where its comment hangs.
 */
export class CanvasReviewMarkPainter implements ReviewMarkPainter {
  async paint(frame: ImageBitmap, marked: ReadonlyArray<ReviewMarkedPlace>): Promise<ImageBitmap> {
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('A 2D canvas could not be opened to paint review marks.');
    context.drawImage(frame, 0, 0);
    const unit = Math.min(frame.width, frame.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const { place } of marked) {
      for (const mark of place.marks) this.paintMark(context, mark, unit, frame);
    }
    // Numbers after every mark, so no line is drawn across another note's number.
    for (const { place, number } of marked) {
      const at = this.toPixels(place.at, frame);
      if (place.marks.length === 0) this.paintPointRing(context, at, unit);
      this.paintLabel(context, this.labelCentreFor(at, unit, frame), number, unit);
    }
    return canvas.transferToImageBitmap();
  }

  private paintMark(context: OffscreenCanvasRenderingContext2D, mark: ReviewMark, unit: number, frame: ImageBitmap): void {
    const path = new Path2D();
    const [first, ...rest] = mark.points.map((point) => this.toPixels(point, frame));
    if (first === undefined) return;
    path.moveTo(first.x, first.y);
    if (rest.length === 0) path.lineTo(first.x + 0.01, first.y);
    for (const point of rest) path.lineTo(point.x, point.y);
    this.inked(context, path, unit);
  }

  private inked(context: OffscreenCanvasRenderingContext2D, path: Path2D, unit: number): void {
    context.strokeStyle = HALO;
    context.lineWidth = unit * (LINE_SHARE + HALO_SHARE);
    context.stroke(path);
    context.strokeStyle = INK;
    context.lineWidth = unit * LINE_SHARE;
    context.stroke(path);
  }

  /** The exact point a comment was dropped on, as a ring, so what is under it still shows. */
  private paintPointRing(context: OffscreenCanvasRenderingContext2D, at: ReviewPoint, unit: number): void {
    const ring = new Path2D();
    ring.arc(at.x, at.y, unit * POINT_RING_SHARE, 0, Math.PI * 2);
    this.inked(context, ring, unit);
  }

  /**
   * Where the number goes: above and to the right of the point, clear of
   * what the note points at, turned back inside the frame near an edge.
   */
  private labelCentreFor(at: ReviewPoint, unit: number, frame: ImageBitmap): ReviewPoint {
    const offset = unit * LABEL_RADIUS_SHARE * 1.6;
    const x = at.x + offset > frame.width - offset ? at.x - offset : at.x + offset;
    const y = at.y - offset < offset ? at.y + offset : at.y - offset;
    return { x, y };
  }

  private paintLabel(context: OffscreenCanvasRenderingContext2D, at: ReviewPoint, number: number, unit: number): void {
    const radius = unit * LABEL_RADIUS_SHARE;
    context.beginPath();
    context.arc(at.x, at.y, radius + unit * HALO_SHARE / 2, 0, Math.PI * 2);
    context.fillStyle = HALO;
    context.fill();
    context.beginPath();
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.fillStyle = INK;
    context.fill();
    context.fillStyle = LABEL_TEXT;
    context.font = `700 ${Math.round(radius * 1.1)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(number), at.x, at.y);
  }

  private toPixels(point: ReviewPoint, frame: ImageBitmap): ReviewPoint {
    return { x: point.x * frame.width, y: point.y * frame.height };
  }
}
