import type { SheetContentResize } from '@presentation/editor/services/SheetContentResizeReader';
import { TouchDragGestureResolver } from '@presentation/gestures/services/TouchDragGestureResolver';

const ABSOLUTE_MIN_PCT = 0.30;
const MAX_PCT = 0.90;
const SNAP_POINTS: readonly number[] = [0.30, 0.60, 0.90];
const INITIAL_PCT = 0.60;

interface DragAnchor {
  readonly startClientY: number;
  readonly startPct: number;
  /** The tallest the drag may make the sheet. */
  readonly ceilingPct: number;
}

interface PendingZoneTouch {
  readonly pointerId: number;
  readonly startClientY: number;
  readonly startPct: number;
}

interface PendingContentTouch {
  readonly touchId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startPct: number;
  readonly resize: SheetContentResize;
}

/**
 * Observable state for the bottom-sheet split percentage. Subscribers
 * listen for `'change'`. Two touch gestures feed the same drag, and
 * neither takes a touch that turns out to mean something else:
 *
 *   - Over the region above the sheet (`startZoneTouchGesture` /
 *     `extendZoneTouchGesture` / `endZoneTouchGesture`), a drag commits
 *     once it turns out vertical, so taps and horizontal scrubs over the
 *     wrapped children are unaffected. `extendZoneTouchGesture` returns
 *     `true` on the move that commits it.
 *   - Over the sheet's own content (`startContentTouchGesture` /
 *     `extendContentTouchGesture` / `endContentTouchGesture`), the first
 *     move decides, since the browser starts scrolling right after it: a
 *     vertical move resizes where the content allows it (see
 *     `SheetContentResize`), and anything else is left to the content for
 *     the whole touch. A drag that may only shrink the sheet never grows it
 *     past where it started.
 *
 * On release the percentage snaps to the closest of a small fixed
 * set of stops. The initial percentage rests at a middle stop so the
 * video preview and the sidebar both start visible.
 */
export class BottomSheetResizeController extends EventTarget {

  private _pct: number = INITIAL_PCT;
  private _isDragging = false;
  private dragAnchor: DragAnchor | null = null;
  private pendingZoneTouch: PendingZoneTouch | null = null;
  private pendingContentTouch: PendingContentTouch | null = null;
  private contentTouchId: number | null = null;
  private containerHeightPx = 0;
  private minPctFloor: number = ABSOLUTE_MIN_PCT;
  private readonly touchGesture = new TouchDragGestureResolver();

  get pct(): number {
    return this._pct;
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  setMinPctFloor(floor: number): void {
    const nextFloor = Math.min(MAX_PCT, Math.max(ABSOLUTE_MIN_PCT, floor));
    if (nextFloor === this.minPctFloor) return;
    this.minPctFloor = nextFloor;
    if (this._pct < nextFloor) {
      this._pct = nextFloor;
      this.notify();
    }
  }

  startZoneTouchGesture(pointerId: number, clientX: number, clientY: number, containerHeightPx: number): void {
    this.containerHeightPx = containerHeightPx;
    this.touchGesture.begin(clientX, clientY);
    this.pendingZoneTouch = { pointerId, startClientY: clientY, startPct: this._pct };
  }

  extendZoneTouchGesture(pointerId: number, clientX: number, clientY: number): boolean {
    const pending = this.pendingZoneTouch;
    if (pending && pending.pointerId === pointerId) {
      const decision = this.touchGesture.update(clientX, clientY);
      if (decision === 'pending') return false;
      if (decision === 'horizontal') {
        this.pendingZoneTouch = null;
        return false;
      }
      this.pendingZoneTouch = null;
      this.beginDrag({ startClientY: pending.startClientY, startPct: pending.startPct, ceilingPct: MAX_PCT });
      this.updateDrag(clientY);
      return true;
    }
    if (this._isDragging) {
      this.updateDrag(clientY);
    }
    return false;
  }

  endZoneTouchGesture(pointerId: number): void {
    if (this.pendingZoneTouch?.pointerId === pointerId) {
      this.pendingZoneTouch = null;
    }
    this.endDrag();
  }

  /** A touch landed on the sheet's content, where a drag may resize the sheet as `resize` says. */
  startContentTouchGesture(touchId: number, clientX: number, clientY: number, containerHeightPx: number, resize: SheetContentResize): void {
    this.containerHeightPx = containerHeightPx;
    this.contentTouchId = null;
    this.pendingContentTouch = resize === 'none'
      ? null
      : { touchId, startClientX: clientX, startClientY: clientY, startPct: this._pct, resize };
  }

  /**
   * Follows the touch. Answers whether this move resizes the sheet: from the
   * first move on, for a touch the sheet took, and never for one left to the
   * content. The caller keeps the browser from scrolling on every move that
   * answers `true`.
   */
  extendContentTouchGesture(touchId: number, clientX: number, clientY: number): boolean {
    if (this.contentTouchId === touchId) {
      this.updateDrag(clientY);
      return true;
    }
    const pending = this.pendingContentTouch;
    if (pending === null || pending.touchId !== touchId) return false;
    const dx = clientX - pending.startClientX;
    const dy = clientY - pending.startClientY;
    if (dx === 0 && dy === 0) return false;
    this.pendingContentTouch = null;
    if (!this.contentAllows(pending.resize, dx, dy)) return false;
    this.contentTouchId = touchId;
    const ceilingPct = pending.resize === 'shrink' ? pending.startPct : MAX_PCT;
    this.beginDrag({ startClientY: pending.startClientY, startPct: pending.startPct, ceilingPct });
    this.updateDrag(clientY);
    return true;
  }

  endContentTouchGesture(touchId: number): void {
    if (this.pendingContentTouch?.touchId === touchId) this.pendingContentTouch = null;
    if (this.contentTouchId !== touchId) return;
    this.contentTouchId = null;
    this.endDrag();
  }

  private contentAllows(resize: SheetContentResize, dx: number, dy: number): boolean {
    if (Math.abs(dy) < Math.abs(dx)) return false;
    if (resize === 'both') return true;
    return resize === 'shrink' && dy > 0;
  }

  private beginDrag(anchor: DragAnchor): void {
    this.dragAnchor = anchor;
    this._isDragging = true;
    this.notify();
  }

  private updateDrag(clientY: number): void {
    const anchor = this.dragAnchor;
    if (!anchor || this.containerHeightPx === 0) return;
    const dy = clientY - anchor.startClientY;
    const next = anchor.startPct - dy / this.containerHeightPx;
    const clamped = Math.max(this.minPctFloor, Math.min(anchor.ceilingPct, next));
    if (clamped === this._pct) return;
    this._pct = clamped;
    this.notify();
  }

  private endDrag(): void {
    if (!this._isDragging) return;
    this.dragAnchor = null;
    this._isDragging = false;
    this._pct = this.snapToClosestPoint(this._pct);
    this.notify();
  }

  private snapToClosestPoint(current: number): number {
    const candidates = [this.minPctFloor, ...SNAP_POINTS.filter((p) => p > this.minPctFloor)];
    let best = candidates[0]!;
    for (const candidate of candidates) {
      if (Math.abs(candidate - current) < Math.abs(best - current)) best = candidate;
    }
    return best;
  }

  private notify(): void {
    this.dispatchEvent(new Event('change'));
  }
}
