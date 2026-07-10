/**
 * Current selection inside the subtitle overlay.
 *
 * - `null` — nothing selected.
 * - `{ wordId: null, segmentId }` — segment-only selection.
 * - `{ wordId, segmentId }` — word within `segmentId`. `segmentId` is
 *   anchored to a specific active segment because multiple segments
 *   (across sheets) may be active simultaneously.
 */
export type OverlaySelection = { wordId: string | null; segmentId: string } | null;

/** Viewport-coordinate anchor for the right-click popover; `null` when closed. */
export type OverlayPopoverAnchor = { x: number; y: number } | null;

// A click that misses every word still snaps to the nearest one when it
// lands within this fraction of that word's height — narrow words are
// otherwise a sliver to hit. Beyond the reach the click stays a segment
// click, so the segment itself remains selectable. Tune here.
const WORD_SNAP_DISTANCE_RATIO = 0.5;

/**
 * Owns the overlay's ephemeral selection and right-click popover anchor.
 * Lifecycle is `start()` / `stop()`: start installs the window-level
 * dismiss listeners (outside-mousedown, Escape); stop removes them.
 * Observers subscribe via `subscribe` and read state via
 * `selectionSnapshot` / `popoverSnapshot`.
 *
 * Selection lives in presentation, not in core, because it is not
 * application state: it is not persisted, has no domain meaning, and
 * exists only to drive the overlay surface (popover dispatch, selection
 * ring, drag gating). The manipulation controller consults it
 * synchronously inside `tryStartWordDrag` to gate accidental drags.
 */
export class OverlaySelectionController {
  private readonly subscribers = new Set<() => void>();
  private selection: OverlaySelection = null;
  private popover: OverlayPopoverAnchor = null;
  private onPointerDown: ((event: PointerEvent) => void) | null = null;
  private onKey: ((event: KeyboardEvent) => void) | null = null;

  start(): void {
    if (this.onPointerDown || this.onKey) return;
    // Bound to pointerdown rather than mousedown so a gesture starting on a
    // chrome element outside any `[data-tscaps-segment-id]` ancestor can keep
    // the selection alive by stopping propagation on its own pointerdown —
    // mousedown is a separate event stream and a `stopPropagation` on
    // pointerdown does not silence it.
    this.onPointerDown = (event) => {
      if (!this.selection && !this.popover) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-tscaps-segment-id]')) return;
      if (target.closest('[data-floating-layer]')) return;
      this.dismiss();
    };
    this.onKey = (event) => {
      if (event.key === 'Escape') this.dismiss();
    };
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    if (this.onPointerDown) window.removeEventListener('pointerdown', this.onPointerDown);
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    this.onPointerDown = null;
    this.onKey = null;
    this.subscribers.clear();
    this.selection = null;
    this.popover = null;
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  selectionSnapshot(): OverlaySelection {
    return this.selection;
  }

  popoverSnapshot(): OverlayPopoverAnchor {
    return this.popover;
  }

  setSelection(next: OverlaySelection): void {
    if (this.selection === next) return;
    this.selection = next;
    this.popover = null;
    this.emit();
  }

  /**
   * Resolves a pointer event landing on `target` (at viewport
   * coordinates `clientX`/`clientY`) into a `{ segmentId, wordId }`
   * selection. Returns false if the point is not inside any segment —
   * caller decides what to do (currently: nothing, the global mousedown
   * listener handles outside-click dismissal). When `openPopover` is
   * true, also opens the popover anchored at the click point.
   */
  selectAtPoint(target: HTMLElement, clientX: number, clientY: number, openPopover: boolean): boolean {
    const segmentEl = target.closest<HTMLElement>('[data-tscaps-segment-id]');
    if (!segmentEl) return false;
    const segmentId = segmentEl.getAttribute('data-tscaps-segment-id')!;
    const wordId = this.resolveWordId(target, clientX, clientY, segmentEl);
    this.selection = { wordId, segmentId };
    this.popover = openPopover ? { x: clientX, y: clientY } : null;
    this.emit();
    return true;
  }

  dismiss(): void {
    if (!this.selection && !this.popover) return;
    this.selection = null;
    this.popover = null;
    this.emit();
  }

  private resolveWordId(target: HTMLElement, clientX: number, clientY: number, segmentEl: HTMLElement): string | null {
    const direct = target.closest<HTMLElement>('[data-tscaps-word-id]');
    if (direct) return direct.getAttribute('data-tscaps-word-id');
    return this.snapToNearestWordId(segmentEl, clientX, clientY);
  }

  private snapToNearestWordId(segmentEl: HTMLElement, clientX: number, clientY: number): string | null {
    let nearestId: string | null = null;
    let nearestDistance = Infinity;
    let nearestReach = 0;
    for (const el of segmentEl.querySelectorAll<HTMLElement>('[data-tscaps-word-id]')) {
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = el.getAttribute('data-tscaps-word-id');
        nearestReach = rect.height * WORD_SNAP_DISTANCE_RATIO;
      }
    }
    return nearestDistance <= nearestReach ? nearestId : null;
  }

  private emit(): void {
    for (const callback of this.subscribers) callback();
  }
}
