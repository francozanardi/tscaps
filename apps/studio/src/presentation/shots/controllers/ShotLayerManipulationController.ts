import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { DRAG_ACTIVATION_THRESHOLD_PX } from '@presentation/editor/controllers/OverlayManipulationTypes';
import type { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import { PointerDragSession } from '@presentation/gestures/controllers/PointerDragSession';
import type { ShotLayerGesture } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import type {
  InsetLayerGestureGeometry,
  InsetLayerGestureResult,
  InsetLayerGestureStart,
} from '@presentation/shots/services/InsetLayerGestureGeometry';
import type { ShotLayerHitTarget } from '@presentation/shots/services/ShotLayerHitTargetResolver';

/** A box over the video being dragged, while it is, and whether its centre is on the frame's centre lines. */
export interface ShotLayerDragState {
  readonly layerId: string;
  readonly gesture: ShotLayerGesture;
  readonly snappedToVerticalCentre: boolean;
  readonly snappedToHorizontalCentre: boolean;
}

/** Where the frame sits on screen and the press that started a gesture on it. */
export interface ShotLayerGesturePress {
  /** The preview's frame on screen, which the pointer is measured against. */
  readonly frameRect: DOMRect;
  readonly event: PointerEvent;
}

/** Where the pointer is over the preview's frame, while it rests on a box or one of its corners. */
export interface ShotLayerPointer {
  /** The preview's frame on screen, which the pointer is measured against. */
  readonly frameRect: DOMRect;
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * A gesture the pointer is over that the layer's own CSS has taken
 * over, so it would move nothing, and where to say so: the pointer, as
 * fractions of the frame's width and height.
 */
export interface ShotLayerGestureRefusal {
  readonly layerId: string;
  readonly gesture: ShotLayerGesture;
  readonly x: number;
  readonly y: number;
}

type GestureMove = (start: InsetLayerGestureStart, press: PointerEvent, event: PointerEvent, frameRect: DOMRect) => InsetLayerGestureResult;

/**
 * Moves and resizes a box over the video with the pointer: a press
 * inside the box moves it once the pointer has travelled past the
 * threshold the caption drags use, and a press on a corner resizes it
 * from the first move. Only one gesture runs at a time.
 *
 * Pressing a box picks it — on the user's behalf, so it opens nothing —
 * and a drag swallows the click that follows it, so moving a box never
 * opens its panel either. Every move writes the layout fields through the
 * placement action, so the preview draws the box where it is going and
 * a run of moves on one layer is one undo step. Only the dragged layer
 * moves.
 *
 * A gesture the layer's own CSS has taken over (the target's
 * `cssOwnedGestures`) does not start: the fields it would write decide
 * nothing on screen. A press there still picks the box, and while the
 * pointer rests on it the refusal is published, for the overlay to say
 * why nothing will move. Nothing is refused while a gesture runs.
 */
export class ShotLayerManipulationController {
  private readonly subscribers = new Set<() => void>();
  private session: PointerDragSession | null = null;
  private dragState: ShotLayerDragState | null = null;
  private refusal: ShotLayerGestureRefusal | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly gestures: InsetLayerGestureGeometry,
    private readonly setPlacement: SetShotLayerPlacementAction,
    private readonly selection: OverlaySelectionController,
    private readonly clickSuppressor: NextClickSuppressor,
  ) {}

  stop(): void {
    this.endSession();
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  /** The drag under way, or null between drags and before the pointer has moved far enough to count as one. */
  snapshot(): ShotLayerDragState | null {
    return this.dragState;
  }

  /** The gesture under the pointer that the layer's CSS has taken over, or null when the pointer rests on none. */
  refusalSnapshot(): ShotLayerGestureRefusal | null {
    return this.refusal;
  }

  /**
   * The pointer moved over `target`'s `gesture` surface: inside the box
   * for a move, on a corner for a resize. Publishes a refusal where its
   * CSS has taken that gesture over, and clears one where it has not.
   */
  pointAt(target: ShotLayerHitTarget, gesture: ShotLayerGesture, pointer: ShotLayerPointer): void {
    if (this.session !== null || !target.cssOwnedGestures.has(gesture)) {
      this.publishRefusal(null);
      return;
    }
    const { frameRect, clientX, clientY } = pointer;
    if (frameRect.width <= 0 || frameRect.height <= 0) return;
    this.publishRefusal({
      layerId: target.layerId,
      gesture,
      x: (clientX - frameRect.left) / frameRect.width,
      y: (clientY - frameRect.top) / frameRect.height,
    });
  }

  /** The pointer left `layerId`'s `gesture` surface. */
  pointerLeft(layerId: string, gesture: ShotLayerGesture): void {
    if (this.refusal?.layerId === layerId && this.refusal.gesture === gesture) this.publishRefusal(null);
  }

  /** Starts moving `target` from a primary-button press inside it. */
  startMove(target: ShotLayerHitTarget, press: ShotLayerGesturePress): void {
    this.start(target, press, 'move', (start, down, event, frameRect) => this.gestures.moved(
      start,
      (event.clientX - down.clientX) / frameRect.width,
      (event.clientY - down.clientY) / frameRect.height,
    ));
  }

  /** Starts resizing `target` from a primary-button press on its `corner`. */
  startResize(target: ShotLayerHitTarget, corner: ResizeCorner, press: ShotLayerGesturePress): void {
    this.start(target, press, 'resize', (start, _down, event, frameRect) => this.gestures.resized(
      start,
      corner,
      (event.clientX - frameRect.left) / frameRect.width,
      (event.clientY - frameRect.top) / frameRect.height,
    ));
  }

  private start(target: ShotLayerHitTarget, press: ShotLayerGesturePress, gesture: ShotLayerGesture, move: GestureMove): void {
    const { event, frameRect } = press;
    if (event.button !== 0 || this.session !== null) return;
    if (target.placement.kind !== 'inset' || frameRect.width <= 0 || frameRect.height <= 0) return;
    event.stopPropagation();
    this.selection.selectShotLayer(target.layerId);
    if (target.cssOwnedGestures.has(gesture)) {
      this.pointAt(target, gesture, { frameRect, clientX: event.clientX, clientY: event.clientY });
      return;
    }
    this.publishRefusal(null);
    const start: InsetLayerGestureStart = {
      placement: target.placement,
      rect: target.rect,
      frame: this.store.snapshot().frameLayout,
    };
    const session = new PointerDragSession(event.pointerId, event.clientX, event.clientY, DRAG_ACTIVATION_THRESHOLD_PX);
    // A corner is aimed at; a press inside the box may still be a click that picks it.
    if (gesture === 'resize') session.activate();
    session.attach({
      onMove: (moved) => {
        if (!session.evaluateActivation(moved.clientX, moved.clientY)) return;
        this.apply(target.layerId, gesture, move(start, event, moved, frameRect));
      },
      onUp: () => {
        if (session.activated) this.clickSuppressor.arm();
        this.endSession();
      },
      onCancel: () => this.endSession(),
    });
    this.session = session;
  }

  private apply(layerId: string, gesture: ShotLayerGesture, result: InsetLayerGestureResult): void {
    this.setPlacement.execute(layerId, result.placement);
    this.dragState = {
      layerId,
      gesture,
      snappedToVerticalCentre: result.snappedToVerticalCentre,
      snappedToHorizontalCentre: result.snappedToHorizontalCentre,
    };
    this.emit();
  }

  private endSession(): void {
    this.session?.dispose();
    this.session = null;
    if (this.dragState === null) return;
    this.dragState = null;
    this.emit();
  }

  private publishRefusal(refusal: ShotLayerGestureRefusal | null): void {
    if (this.isSameRefusal(refusal, this.refusal)) return;
    this.refusal = refusal;
    this.emit();
  }

  private isSameRefusal(first: ShotLayerGestureRefusal | null, second: ShotLayerGestureRefusal | null): boolean {
    if (first === null || second === null) return first === second;
    return first.layerId === second.layerId && first.gesture === second.gesture && first.x === second.x && first.y === second.y;
  }

  private emit(): void {
    for (const callback of this.subscribers) callback();
  }
}
