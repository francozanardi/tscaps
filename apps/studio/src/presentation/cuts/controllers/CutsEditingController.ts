import type { CutRange } from '@core/cuts/domain/CutRegistry';

export interface CutsSelection {
  readonly segmentId: string;
  readonly startSec: number;
  readonly endSec: number;
}

export interface CutsCutEdit {
  readonly segmentId: string;
  readonly originalRange: CutRange;
  readonly range: CutRange;
}

export interface DragEndResult {
  readonly wasClick: boolean;
  readonly clickedSec: number | null;
}

export interface CutEditEndResult {
  readonly originalRange: CutRange;
  readonly newRange: CutRange;
}

const MIN_SELECTION_SEC = 0.01;

/**
 * Observable selection state for the Cuts mode. Subscribers listen for
 * `'change'`. The controller deliberately does not own the cuts list —
 * committed cuts live in the editor store so they participate in
 * undo/redo.
 *
 * Three gestures are tracked, mutually exclusive:
 *
 * - **Fresh drag-selection** on an empty zone (`startDrag` →
 *   `extendDrag` → `endDrag`). Suppressed until the pointer moves past
 *   `MIN_SELECTION_SEC` from the anchor so a click-without-drag never
 *   flashes a one-frame highlight; `endDrag` reports `wasClick` when
 *   the threshold was never exceeded.
 * - **Selection edge-drag** (`startEdgeDrag` → `extendDrag` →
 *   `endDrag`) resizes the live selection by anchoring the opposite
 *   edge. Threshold is pre-cleared because the selection is already
 *   visible.
 * - **Cut edge-drag** (`startCutEdit` → `extendCutEdit` →
 *   `endCutEdit`) holds a live preview of a stored cut's new range
 *   without mutating the registry; the consumer commits the result on
 *   release. Starts by clearing any selection so the surface only
 *   shows one ephemeral state at a time.
 */
export class CutsEditingController extends EventTarget {

  private _selection: CutsSelection | null = null;
  private _dragAnchorSec: number | null = null;
  private _dragSegmentId: string | null = null;
  private _exceededThreshold = false;

  private _cutEdit: CutsCutEdit | null = null;
  private _cutEditAnchorSec: number | null = null;

  get selection(): CutsSelection | null {
    return this._selection;
  }

  get cutEdit(): CutsCutEdit | null {
    return this._cutEdit;
  }

  get isDragging(): boolean {
    return this._dragAnchorSec !== null;
  }

  get isCutEditing(): boolean {
    return this._cutEdit !== null;
  }

  startDrag(segmentId: string, atSec: number): void {
    this.cancelCutEditSilently();
    this._dragAnchorSec = atSec;
    this._dragSegmentId = segmentId;
    this._exceededThreshold = false;
    if (this._selection !== null) {
      this._selection = null;
      this.notify();
    }
  }

  /**
   * Begins a selection edge-drag with `anchorSec` as the fixed edge.
   * Caller passes the opposite edge of the live selection so the
   * pointer's position controls the moving edge. The current selection
   * is preserved until the first `extendDrag` updates it.
   */
  startEdgeDrag(segmentId: string, anchorSec: number): void {
    this.cancelCutEditSilently();
    this._dragAnchorSec = anchorSec;
    this._dragSegmentId = segmentId;
    this._exceededThreshold = true;
  }

  extendDrag(toSec: number): void {
    if (this._dragAnchorSec === null || this._dragSegmentId === null) return;
    const anchor = this._dragAnchorSec;
    if (!this._exceededThreshold && Math.abs(toSec - anchor) < MIN_SELECTION_SEC) return;
    this._exceededThreshold = true;
    const next: CutsSelection = {
      segmentId: this._dragSegmentId,
      startSec: Math.min(anchor, toSec),
      endSec: Math.max(anchor, toSec),
    };
    if (this._selection
      && this._selection.startSec === next.startSec
      && this._selection.endSec === next.endSec
      && this._selection.segmentId === next.segmentId) return;
    this._selection = next;
    this.notify();
  }

  endDrag(): DragEndResult {
    if (this._dragAnchorSec === null) {
      return { wasClick: false, clickedSec: null };
    }
    const anchor = this._dragAnchorSec;
    const wasClick = !this._exceededThreshold;
    this._dragAnchorSec = null;
    this._dragSegmentId = null;
    this._exceededThreshold = false;
    return { wasClick, clickedSec: wasClick ? anchor : null };
  }

  /**
   * Begins a cut edge-drag. `originalRange` is the stored cut being
   * resized; `anchorSec` is the opposite edge that stays fixed. The
   * preview starts at the original range and updates as the pointer
   * moves. The current selection is cleared so the row only shows the
   * cut preview.
   */
  startCutEdit(segmentId: string, originalRange: CutRange, anchorSec: number): void {
    this._cutEdit = { segmentId, originalRange, range: originalRange };
    this._cutEditAnchorSec = anchorSec;
    this._dragAnchorSec = null;
    this._dragSegmentId = null;
    this._exceededThreshold = false;
    if (this._selection !== null) {
      this._selection = null;
    }
    this.notify();
  }

  extendCutEdit(toSec: number): void {
    if (this._cutEdit === null || this._cutEditAnchorSec === null) return;
    const anchor = this._cutEditAnchorSec;
    const next: CutRange = {
      startSec: Math.min(anchor, toSec),
      endSec: Math.max(anchor, toSec),
    };
    if (next.endSec - next.startSec < MIN_SELECTION_SEC) return;
    if (this._cutEdit.range.startSec === next.startSec && this._cutEdit.range.endSec === next.endSec) return;
    this._cutEdit = { ...this._cutEdit, range: next };
    this.notify();
  }

  /**
   * Concludes the cut edge-drag. Returns the original and new ranges
   * when they differ so the caller can commit; returns `null` when
   * nothing changed (a click-without-drag on a handle).
   */
  endCutEdit(): CutEditEndResult | null {
    if (this._cutEdit === null) return null;
    const { originalRange, range } = this._cutEdit;
    this._cutEdit = null;
    this._cutEditAnchorSec = null;
    this.notify();
    if (originalRange.startSec === range.startSec && originalRange.endSec === range.endSec) {
      return null;
    }
    return { originalRange, newRange: range };
  }

  clearSelection(): void {
    if (this._selection === null && this._dragAnchorSec === null && this._cutEdit === null) return;
    this._selection = null;
    this._dragAnchorSec = null;
    this._dragSegmentId = null;
    this._exceededThreshold = false;
    this._cutEdit = null;
    this._cutEditAnchorSec = null;
    this.notify();
  }

  /**
   * Replaces the current selection with the given range on `segmentId`,
   * cancelling any in-progress drag. Used by UI affordances that map a
   * single click on a discrete element (a word chip, a silence chip) to
   * a selection that exactly covers that element's time range. Ranges
   * shorter than `MIN_SELECTION_SEC` are ignored.
   */
  selectRange(segmentId: string, startSec: number, endSec: number): void {
    if (endSec - startSec < MIN_SELECTION_SEC) return;
    const next: CutsSelection = { segmentId, startSec, endSec };
    this.cancelCutEditSilently();
    this._dragAnchorSec = null;
    this._dragSegmentId = null;
    this._exceededThreshold = false;
    if (this._selection
      && this._selection.segmentId === next.segmentId
      && this._selection.startSec === next.startSec
      && this._selection.endSec === next.endSec) return;
    this._selection = next;
    this.notify();
  }

  private cancelCutEditSilently(): void {
    this._cutEdit = null;
    this._cutEditAnchorSec = null;
  }

  private notify(): void {
    this.dispatchEvent(new Event('change'));
  }
}
