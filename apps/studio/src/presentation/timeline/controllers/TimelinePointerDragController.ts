import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import type {
  TimelineRowBinding,
  TimelineRowViewportRegistry,
} from '@presentation/timeline/controllers/TimelineRowViewportRegistry';
import type { TimelinePointerTimeResolver } from '@presentation/timeline/services/TimelinePointerTimeResolver';
import type { TimelineEdgeScrollVelocity } from '@presentation/timeline/services/TimelineEdgeScrollVelocity';
import type {
  TimelineWordDragMode,
  TimelineWordDragTarget,
  TimelineWordEditGesture,
} from '@presentation/timeline/controllers/gestures/TimelineWordEditGesture';
import type {
  TimelineSceneDragEdge,
  TimelineSceneEditGesture,
} from '@presentation/timeline/controllers/gestures/TimelineSceneEditGesture';
import type { TimelineSceneMoveGesture } from '@presentation/timeline/controllers/gestures/TimelineSceneMoveGesture';
import type { TimelineSceneMoveSubject } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSceneDragTarget } from '@presentation/timeline/services/TimelineSceneDragTargets';
import type { TimelineSnapResolver } from '@presentation/timeline/services/TimelineSnapResolver';
import type { TimelineSnapLandmarks } from '@presentation/timeline/services/TimelineSnapLandmarks';
import type { TouchDragGestureResolver } from '@presentation/gestures/services/TouchDragGestureResolver';
import { PointerDragSession } from '@presentation/gestures/controllers/PointerDragSession';

export interface TimelinePointerOrigin {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerType: string;
}

type ActiveGesture =
  | { readonly kind: 'awaiting-touch-axis'; readonly initialSec: number }
  | { readonly kind: 'range'; readonly clickSeekSec: number | null }
  | { readonly kind: 'cut-edit' }
  | { readonly kind: 'word-edit' }
  | { readonly kind: 'scene-edit' }
  | { readonly kind: 'scene-move' };

/**
 * Drives every pointer gesture over the cuts timeline: drag to select
 * a range, drag a selection's edge, drag a stored cut's edge, drag or
 * stretch a word, stretch a scene's window, and carry scenes through
 * time. One gesture is in flight at a time.
 *
 * The gesture belongs to the timeline as a whole rather than to the
 * row the press landed on, because a selection is a plain time
 * interval that may cover many rows. Positions resolve through the
 * time resolver, which reads whichever row currently sits under the
 * pointer.
 *
 * Rows are virtualized, so the row a gesture started on can be
 * recycled while the pointer is still down. Move, up and cancel
 * therefore ride on `window` through the session, and the pointer is
 * captured on the panel's scroll container, which outlives the rows.
 *
 * While a gesture runs, the range is re-derived once per frame from
 * the last known pointer position rather than from the move event
 * itself. A still pointer over moving content emits no events at all —
 * which is what both the edge auto-scroll and a wheel turn with the
 * button held look like — so an event-driven gesture would freeze
 * exactly when the content slides underneath it. The same frame
 * applies the auto-scroll, so no scroll listener is needed.
 *
 * Touch presses wait for the gesture resolver to pick a dominant axis:
 * a vertical drag is handed back to the browser so the panel scrolls,
 * a horizontal one becomes a selection, and a release before either
 * seeks like a tap.
 */
export class TimelinePointerDragController {

  private session: PointerDragSession | null = null;
  private gesture: ActiveGesture | null = null;
  private scrollElement: HTMLElement | null = null;
  private snapLandmarks: TimelineSnapLandmarks | null = null;
  private lastClientX = 0;
  private lastClientY = 0;
  private frameHandle: number | null = null;
  private lastFrameMs: number | null = null;

  constructor(
    private readonly editing: TimelineEditingController,
    private readonly rows: TimelineRowViewportRegistry,
    private readonly timeResolver: TimelinePointerTimeResolver,
    private readonly edgeScroll: TimelineEdgeScrollVelocity,
    private readonly touchAxis: TouchDragGestureResolver,
    private readonly wordEdit: TimelineWordEditGesture,
    private readonly sceneEdit: TimelineSceneEditGesture,
    private readonly sceneMove: TimelineSceneMoveGesture,
    private readonly snapResolver: TimelineSnapResolver,
    private readonly seek: (timeSec: number) => void,
    private readonly resizeCut: (originalRange: CutRange, newRange: CutRange) => void,
  ) {}

  /**
   * Publishes the landmarks every dragged edge sticks to. They follow
   * the document and the channel on screen, so they are handed over
   * rather than held: a gesture in flight keeps using whichever set was
   * current when it started reading them.
   */
  setSnapLandmarks(landmarks: TimelineSnapLandmarks): void {
    this.snapLandmarks = landmarks;
  }

  /**
   * The panel's scroll container: the element the pointer is captured
   * on and the one the gesture scrolls when the pointer leaves it.
   */
  setScrollElement(element: HTMLElement | null): void {
    this.scrollElement = element;
  }

  /** Publishes a mounted row's geometry. The returned callback withdraws it. */
  bindRow(binding: TimelineRowBinding): () => void {
    this.rows.register(binding);
    return () => this.rows.unregister(binding.index);
  }

  beginRangeDrag(origin: TimelinePointerOrigin): void {
    if (this.session) return;
    const initialSec = this.timeResolver.resolve(origin.clientX, origin.clientY);
    if (initialSec === null) return;
    if (origin.pointerType === 'touch') {
      this.touchAxis.begin(origin.clientX, origin.clientY);
      this.openSession(origin, { kind: 'awaiting-touch-axis', initialSec });
      return;
    }
    this.capturePointer(origin.pointerId);
    // The anchor snaps, the seek does not. A selection with only its
    // moving edge on a landmark can never be flush at both ends, while a
    // click that travelled nowhere should play from where it landed.
    this.editing.startDrag(this.snapped(initialSec));
    this.openSession(origin, { kind: 'range', clickSeekSec: initialSec });
    this.startFrameLoop();
  }

  /** Resizes the live selection, holding `anchorSec` as the fixed edge. */
  beginSelectionEdgeDrag(anchorSec: number, origin: TimelinePointerOrigin): void {
    if (this.session) return;
    this.capturePointer(origin.pointerId);
    this.editing.startEdgeDrag(anchorSec);
    this.openSession(origin, { kind: 'range', clickSeekSec: null }).activate();
    this.startFrameLoop();
  }

  /** Resizes a stored cut, holding `anchorSec` as the fixed edge. */
  beginCutEdgeDrag(cut: CutRange, anchorSec: number, origin: TimelinePointerOrigin): void {
    if (this.session) return;
    this.capturePointer(origin.pointerId);
    this.editing.startCutEdit(cut, anchorSec);
    this.openSession(origin, { kind: 'cut-edit' }).activate();
    this.startFrameLoop();
  }

  /**
   * Stretches a selected scene's window from one of its edges. Left
   * un-activated like the word edit, so a press that never travels
   * stays a press on the scene rather than a no-op edit of it.
   */
  beginSceneEdgeDrag(
    target: TimelineSceneDragTarget | null,
    edge: TimelineSceneDragEdge,
    origin: TimelinePointerOrigin,
  ): void {
    if (this.session) return;
    if (!this.sceneEdit.begin(target, edge)) return;
    this.capturePointer(origin.pointerId);
    this.openSession(origin, { kind: 'scene-edit' });
    this.startFrameLoop();
  }

  /**
   * Carries scenes through time as one block.
   *
   * The pointer is captured only once the press has travelled. A press
   * that never does is a click on the scene, and it has to reach the
   * scene as one — capturing straight away would hand the release to the
   * scroll container and the click with it.
   */
  beginSceneMove(subjects: ReadonlyArray<TimelineSceneMoveSubject>, origin: TimelinePointerOrigin): void {
    if (this.session) return;
    const pointerSec = this.timeResolver.resolve(origin.clientX, origin.clientY);
    if (pointerSec === null) return;
    const carried = new Set(subjects.map((subject) => subject.segmentId));
    const landmarks = this.snapLandmarks?.excluding(carried) ?? [];
    if (!this.sceneMove.begin(subjects, pointerSec, landmarks)) return;
    this.openSession(origin, { kind: 'scene-move' });
    this.startFrameLoop();
  }

  /**
   * Slides or stretches a word. The press is left un-activated on
   * purpose: a release before the pointer travels far enough is a
   * click on the word, not an edit of it.
   */
  beginWordEdit(target: TimelineWordDragTarget, mode: TimelineWordDragMode, origin: TimelinePointerOrigin): void {
    if (this.session) return;
    const pointerSec = this.timeResolver.resolve(origin.clientX, origin.clientY);
    if (pointerSec === null) return;
    if (!this.wordEdit.begin(target, mode, pointerSec)) return;
    this.capturePointer(origin.pointerId);
    this.openSession(origin, { kind: 'word-edit' });
    this.startFrameLoop();
  }

  /** Abandons any gesture in flight, leaving the committed state alone. */
  cancel(): void {
    if (!this.session) return;
    this.finishOnCancel();
  }

  private openSession(origin: TimelinePointerOrigin, gesture: ActiveGesture): PointerDragSession {
    const session = new PointerDragSession(origin.pointerId, origin.clientX, origin.clientY);
    this.session = session;
    this.gesture = gesture;
    this.lastClientX = origin.clientX;
    this.lastClientY = origin.clientY;
    session.attach({
      onMove: (event) => this.onMove(event),
      onUp: (event) => this.onUp(event),
      onCancel: () => this.finishOnCancel(),
    });
    return session;
  }

  private onMove(event: PointerEvent): void {
    const session = this.session;
    const gesture = this.gesture;
    if (!session || !gesture) return;
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    if (gesture.kind === 'awaiting-touch-axis') {
      this.resolveTouchAxis(session, gesture.initialSec, event);
      return;
    }
    const wasActivated = session.activated;
    const activated = session.evaluateActivation(event.clientX, event.clientY);
    if (!wasActivated && activated && gesture.kind === 'scene-move') this.capturePointer(session.pointerId);
  }

  private resolveTouchAxis(session: PointerDragSession, initialSec: number, event: PointerEvent): void {
    const decision = this.touchAxis.update(event.clientX, event.clientY);
    if (decision === 'pending') return;
    if (decision === 'vertical') {
      this.closeSession();
      return;
    }
    this.capturePointer(session.pointerId);
    session.activate();
    this.editing.startDrag(this.snapped(initialSec));
    this.gesture = { kind: 'range', clickSeekSec: null };
    this.startFrameLoop();
  }

  private startFrameLoop(): void {
    if (this.frameHandle !== null) return;
    this.lastFrameMs = null;
    this.frameHandle = requestAnimationFrame(this.onFrame);
  }

  private stopFrameLoop(): void {
    if (this.frameHandle === null) return;
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private readonly onFrame = (nowMs: number): void => {
    this.frameHandle = requestAnimationFrame(this.onFrame);
    const previousMs = this.lastFrameMs;
    this.lastFrameMs = nowMs;
    if (previousMs !== null) this.scrollTowardsPointer((nowMs - previousMs) / 1000);
    this.extendToPointer();
  };

  private scrollTowardsPointer(elapsedSec: number): void {
    const element = this.scrollElement;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const velocity = this.edgeScroll.forPointer(this.lastClientY, rect.top, rect.bottom);
    if (velocity === 0) return;
    element.scrollTop += velocity * elapsedSec;
  }

  private extendToPointer(): void {
    const session = this.session;
    const gesture = this.gesture;
    if (!session || !gesture || !session.activated) return;
    const timeSec = this.timeResolver.resolve(this.lastClientX, this.lastClientY);
    if (timeSec === null) return;
    if (gesture.kind === 'cut-edit') {
      this.editing.extendCutEdit(this.snapped(timeSec));
      return;
    }
    if (gesture.kind === 'word-edit') {
      this.wordEdit.extend(timeSec, this.secondsPerPixel());
      return;
    }
    if (gesture.kind === 'scene-edit') {
      this.sceneEdit.extend(this.snapped(timeSec));
      return;
    }
    if (gesture.kind === 'scene-move') {
      this.sceneMove.extend(timeSec, this.secondsPerPixel());
      return;
    }
    if (gesture.kind === 'range') this.editing.extendDrag(this.snapped(timeSec));
  }

  // The word gesture snaps inside itself, against the landmarks its own
  // neighbours add; a selection edge and a cut edge have no neighbours
  // of their own and stick to the timeline's landmarks as they are.
  private snapped(timeSec: number): number {
    const landmarks = this.snapLandmarks;
    if (!landmarks) return timeSec;
    return this.snapResolver.snap(timeSec, landmarks.all, this.secondsPerPixel());
  }

  // Snapping reaches a fixed number of pixels, so it needs the
  // timeline's scale. Every row is drawn at the same one, so any row on
  // screen answers for all of them. A timeline that cannot be measured
  // reports zero, which turns snapping off rather than inventing a
  // distance.
  private secondsPerPixel(): number {
    const binding = this.rows.anyMounted();
    if (!binding) return 0;
    const widthPx = binding.element.getBoundingClientRect().width;
    if (widthPx <= 0) return 0;
    return (binding.endSec - binding.startSec) / widthPx;
  }

  private onUp(event: PointerEvent): void {
    const session = this.session;
    const gesture = this.gesture;
    if (!session || !gesture) return;
    this.releasePointer(session.pointerId);
    if (gesture.kind === 'awaiting-touch-axis') {
      // A tap is the only way out of a selection on touch. There is no
      // Escape key, and this branch never reached `startDrag`, which is
      // what discards the selection when a press comes from a mouse.
      this.editing.clearSelectionIfOutside(gesture.initialSec);
      this.editing.closeSceneIfOutside(gesture.initialSec);
      this.seek(gesture.initialSec);
      this.closeSession();
      return;
    }
    // The release can land further than the last frame managed to
    // follow, so the final position is applied here rather than left
    // to a frame that will never run.
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    const wasClick = !session.evaluateActivation(event.clientX, event.clientY);
    if (!wasClick) this.extendToPointer();
    if (gesture.kind === 'cut-edit') {
      const result = this.editing.endCutEdit();
      if (result) this.resizeCut(result.originalRange, result.newRange);
      this.closeSession();
      return;
    }
    if (gesture.kind === 'word-edit') {
      this.wordEdit.finish();
      this.closeSession();
      return;
    }
    if (gesture.kind === 'scene-edit') {
      this.sceneEdit.finish();
      this.closeSession();
      return;
    }
    if (gesture.kind === 'scene-move') {
      this.sceneMove.finish();
      this.closeSession();
      return;
    }
    this.editing.endDrag();
    if (wasClick && gesture.clickSeekSec !== null) this.seek(gesture.clickSeekSec);
    this.closeSession();
  }

  // A cancelled cut resize is dropped rather than committed: the user
  // never released on the size they were shown. A cancelled selection
  // keeps whatever range it had reached, which is the state already on
  // screen.
  private finishOnCancel(): void {
    const session = this.session;
    const gesture = this.gesture;
    if (session) this.releasePointer(session.pointerId);
    if (gesture?.kind === 'cut-edit') this.editing.endCutEdit();
    if (gesture?.kind === 'word-edit') this.wordEdit.cancel();
    if (gesture?.kind === 'scene-edit') this.sceneEdit.cancel();
    if (gesture?.kind === 'scene-move') this.sceneMove.cancel();
    if (gesture?.kind === 'range') this.editing.endDrag();
    this.closeSession();
  }

  private closeSession(): void {
    this.stopFrameLoop();
    this.session?.dispose();
    this.session = null;
    this.gesture = null;
  }

  private capturePointer(pointerId: number): void {
    this.scrollElement?.setPointerCapture(pointerId);
  }

  private releasePointer(pointerId: number): void {
    const element = this.scrollElement;
    if (element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }
}
