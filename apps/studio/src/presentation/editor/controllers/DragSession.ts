import type { AnyDragTarget } from '@presentation/editor/controllers/OverlayManipulationTypes';

export interface DragPointerHandlers {
  onMove(event: PointerEvent): void;
  onUp(event: PointerEvent): void;
  onCancel(event: PointerEvent): void;
}

export interface PointerDelta {
  readonly dx: number;
  readonly dy: number;
}

/**
 * State of a single in-flight overlay drag. Snapshots the anchor rect
 * (the element whose centroid follows the cursor) and the scaler rect
 * at pointerdown so later geometry derives from a fixed frame even if
 * the DOM shifts mid-drag. Owns the move/up/cancel listeners on
 * `window` so events keep flowing even when the originating element
 * unmounts mid-gesture — a word drag at activation lifts the word
 * into a positioned-word sibling, which destroys the original span,
 * and a per-element listener would die with it. Each handler call is
 * filtered by `pointerId` so an unrelated touch on a multi-pointer
 * device cannot drive this session.
 *
 * The session is "activated" once the cursor has crossed the
 * activation threshold; a release before that point counts as a
 * plain click and produces no commit. Target shape is a
 * discriminated union — segment vs word — so the controller can
 * branch on `target.kind` to decide what to paint and what to commit,
 * while the session itself stays kind-agnostic.
 */
export class DragSession {
  private hasActivated = false;
  private installedHandlers: DragPointerHandlers | null = null;

  constructor(
    readonly target: AnyDragTarget,
    readonly anchorRect: DOMRect,
    readonly scalerRect: DOMRect,
    readonly startClientX: number,
    readonly startClientY: number,
    readonly pointerId: number,
    private readonly activationThresholdPx: number,
  ) {}

  attach(handlers: DragPointerHandlers): void {
    if (this.installedHandlers) return;
    const filtered: DragPointerHandlers = {
      onMove: (event) => { if (event.pointerId === this.pointerId) handlers.onMove(event); },
      onUp: (event) => { if (event.pointerId === this.pointerId) handlers.onUp(event); },
      onCancel: (event) => { if (event.pointerId === this.pointerId) handlers.onCancel(event); },
    };
    this.installedHandlers = filtered;
    window.addEventListener('pointermove', filtered.onMove);
    window.addEventListener('pointerup', filtered.onUp);
    window.addEventListener('pointercancel', filtered.onCancel);
  }

  dispose(): void {
    const handlers = this.installedHandlers;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onCancel);
    this.installedHandlers = null;
  }

  delta(clientX: number, clientY: number): PointerDelta {
    return { dx: clientX - this.startClientX, dy: clientY - this.startClientY };
  }

  /** Latches `activated` once the cursor has moved past the threshold. Returns the latched value. */
  evaluateActivation(clientX: number, clientY: number): boolean {
    if (this.hasActivated) return true;
    const { dx, dy } = this.delta(clientX, clientY);
    if (Math.hypot(dx, dy) >= this.activationThresholdPx) this.hasActivated = true;
    return this.hasActivated;
  }

  get activated(): boolean {
    return this.hasActivated;
  }
}
