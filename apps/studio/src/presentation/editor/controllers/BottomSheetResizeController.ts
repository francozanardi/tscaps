import { TouchDragGestureResolver } from '@presentation/editor/services/TouchDragGestureResolver';

const ABSOLUTE_MIN_PCT = 0.30;
const MAX_PCT = 0.90;
const SNAP_POINTS: readonly number[] = [0.30, 0.60, 0.90];
const INITIAL_PCT = 0.60;

interface DragAnchor {
  readonly startClientY: number;
  readonly startPct: number;
}

interface PendingTouchAnchor {
  readonly pointerId: number;
  readonly startClientY: number;
  readonly startPct: number;
}

/**
 * Observable state for the bottom-sheet split percentage. Subscribers
 * listen for `'change'`. Two entry points feed the same drag:
 *
 *   - The handle path (`startHandleDrag` / `extendHandleDrag` /
 *     `endDrag`) begins tracking on pointer-down. Use it on a
 *     dedicated handle element.
 *   - The zone touch path (`startZoneTouchGesture` /
 *     `extendZoneTouchGesture` / `endZoneTouchGesture`) is permissive:
 *     it commits only after a touch movement turns out to be
 *     vertical-dominant, so taps and horizontal scrubs over the
 *     wrapped children are unaffected. `extendZoneTouchGesture`
 *     returns `true` on the move that commits the drag — the caller
 *     should `setPointerCapture` on that frame.
 *
 * On release the percentage snaps to the closest of a small fixed
 * set of stops. The initial percentage rests at a middle stop so the
 * video preview and the sidebar both start visible.
 */
export class BottomSheetResizeController extends EventTarget {

  private _pct: number = INITIAL_PCT;
  private _isDragging = false;
  private dragAnchor: DragAnchor | null = null;
  private pendingTouch: PendingTouchAnchor | null = null;
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

  startHandleDrag(clientY: number, containerHeightPx: number): void {
    this.containerHeightPx = containerHeightPx;
    this.beginDrag({ startClientY: clientY, startPct: this._pct });
  }

  extendHandleDrag(clientY: number): void {
    this.updateDrag(clientY);
  }

  startZoneTouchGesture(pointerId: number, clientX: number, clientY: number, containerHeightPx: number): void {
    this.containerHeightPx = containerHeightPx;
    this.touchGesture.begin(clientX, clientY);
    this.pendingTouch = { pointerId, startClientY: clientY, startPct: this._pct };
  }

  extendZoneTouchGesture(pointerId: number, clientX: number, clientY: number): boolean {
    const pending = this.pendingTouch;
    if (pending && pending.pointerId === pointerId) {
      const decision = this.touchGesture.update(clientX, clientY);
      if (decision === 'pending') return false;
      if (decision === 'horizontal') {
        this.pendingTouch = null;
        return false;
      }
      this.pendingTouch = null;
      this.beginDrag({ startClientY: pending.startClientY, startPct: pending.startPct });
      this.updateDrag(clientY);
      return true;
    }
    if (this._isDragging) {
      this.updateDrag(clientY);
    }
    return false;
  }

  endZoneTouchGesture(pointerId: number): void {
    if (this.pendingTouch?.pointerId === pointerId) {
      this.pendingTouch = null;
    }
    if (this._isDragging) {
      this.endDrag();
    }
  }

  endDrag(): void {
    if (!this._isDragging) return;
    this.dragAnchor = null;
    this._isDragging = false;
    this._pct = this.snapToClosestPoint(this._pct);
    this.notify();
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
    const clamped = Math.max(this.minPctFloor, Math.min(MAX_PCT, next));
    if (clamped === this._pct) return;
    this._pct = clamped;
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
