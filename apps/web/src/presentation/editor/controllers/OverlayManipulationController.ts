import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import type { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import type { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import type { SetWordStyleOverrideAction } from '@core/editor/actions/words/SetWordStyleOverrideAction';
import type { ClearWordAlignmentOverrideAction } from '@core/editor/actions/words/ClearWordAlignmentOverrideAction';
import type { SetSegmentStyleOverrideAction } from '@core/editor/actions/segments/SetSegmentStyleOverrideAction';
import type { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import type { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import type { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import type { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import type { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import type { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import type { FontSizeBounds } from '@presentation/editor/services/FontSizeBounds';
import type { DragSession } from '@presentation/editor/controllers/DragSession';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import { SegmentDragGesture } from '@presentation/editor/controllers/gestures/SegmentDragGesture';
import { WordDragGesture } from '@presentation/editor/controllers/gestures/WordDragGesture';
import { SegmentResizeGesture } from '@presentation/editor/controllers/gestures/SegmentResizeGesture';
import { WordResizeGesture } from '@presentation/editor/controllers/gestures/WordResizeGesture';
import { SegmentRotateGesture } from '@presentation/editor/controllers/gestures/SegmentRotateGesture';
import { WordRotateGesture } from '@presentation/editor/controllers/gestures/WordRotateGesture';
import type {
  AnyDragTarget,
  OverlayDragState,
  OverlayGestureHost,
  SegmentBindInput,
  SegmentResizeBindInput,
  SegmentRotateBindInput,
  SnapGuide,
  WordBindInput,
  WordResizeBindInput,
  WordRotateBindInput,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

export type {
  SegmentDragTarget,
  WordDragTarget,
  SegmentResizeTarget,
  WordResizeTarget,
  SegmentRotateTarget,
  WordRotateTarget,
  AnyDragTarget,
  SegmentDragState,
  WordDragState,
  SegmentResizeState,
  WordResizeState,
  SegmentRotateState,
  WordRotateState,
  OverlayDragState,
  SegmentBindInput,
  WordBindInput,
  SegmentResizeBindInput,
  WordResizeBindInput,
  SegmentRotateBindInput,
  WordRotateBindInput,
  SnapGuide,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Coordinates pointer-driven manipulations of the subtitle overlay
 * by dispatching to one gesture per kind (segment / word drag-to-
 * move, segment / word resize). Owns the single active drag session
 * — only one gesture is in flight at a time — plus the scaler ref,
 * the segment binding table that gestures consult, and the
 * subscriber list React reads through `snapshot`.
 *
 * Elements register via `bindSegment` / `bindWord` /
 * `bindSegmentResizeHandle` / `bindWordResizeHandle`, each
 * delegated to the matching gesture. Gestures request a session via
 * the `OverlayGestureHost` protocol the controller implements.
 */
export class OverlayManipulationController implements OverlayGestureHost {
  private readonly subscribers = new Set<() => void>();
  private readonly segmentBindings = new SegmentBindingRegistry();
  private activeSession: DragSession | null = null;
  private dragState: OverlayDragState | null = null;
  private scalerElement: HTMLElement | null = null;
  private readonly segmentDrag: SegmentDragGesture;
  private readonly wordDrag: WordDragGesture;
  private readonly segmentResize: SegmentResizeGesture;
  private readonly wordResize: WordResizeGesture;
  private readonly segmentRotate: SegmentRotateGesture;
  private readonly wordRotate: WordRotateGesture;

  constructor(
    editorStore: EditorStore,
    updateAlignment: UpdateAlignmentAction,
    updateTypography: UpdateTypographyAction,
    updateRotation: UpdateRotationAction,
    setWordStyleOverride: SetWordStyleOverrideAction,
    clearWordAlignmentOverride: ClearWordAlignmentOverrideAction,
    setSegmentStyleOverride: SetSegmentStyleOverrideAction,
    private readonly snapResolver: SnapZoneResolver,
    geometryResolver: DragGeometryResolver,
    resizeGeometry: ResizeGeometryResolver,
    rotationGeometry: RotationGeometryResolver,
    fontSizeBounds: FontSizeBounds,
    transformPainter: DragTransformPainter,
    private readonly clickSuppressor: NextClickSuppressor,
    selectionController: OverlaySelectionController,
  ) {
    this.segmentDrag = new SegmentDragGesture(
      this, this.segmentBindings, updateAlignment, snapResolver, geometryResolver, transformPainter,
    );
    this.wordDrag = new WordDragGesture(
      this, this.segmentBindings, editorStore, setWordStyleOverride, clearWordAlignmentOverride,
      snapResolver, geometryResolver, selectionController,
    );
    this.segmentResize = new SegmentResizeGesture(
      this, this.segmentBindings, editorStore, updateTypography, setSegmentStyleOverride, resizeGeometry, fontSizeBounds,
    );
    this.wordResize = new WordResizeGesture(
      this, editorStore, setWordStyleOverride, resizeGeometry, fontSizeBounds,
    );
    this.segmentRotate = new SegmentRotateGesture(
      this, this.segmentBindings, editorStore, updateRotation, setSegmentStyleOverride, rotationGeometry,
    );
    this.wordRotate = new WordRotateGesture(
      this, editorStore, setWordStyleOverride, rotationGeometry,
    );
  }

  start(): void {
    // Per-binding pointerdown listeners drive everything; nothing global to install.
  }

  stop(): void {
    if (this.activeSession) this.cancelActiveSession();
    this.segmentBindings.clear();
    this.subscribers.clear();
    this.scalerElement = null;
  }

  setScaler(element: HTMLElement | null): void {
    this.scalerElement = element;
  }

  bindSegment(input: SegmentBindInput): () => void {
    return this.segmentDrag.bind(input);
  }

  bindWord(input: WordBindInput): () => void {
    return this.wordDrag.bind(input);
  }

  bindSegmentResizeHandle(input: SegmentResizeBindInput): () => void {
    return this.segmentResize.bind(input);
  }

  bindWordResizeHandle(input: WordResizeBindInput): () => void {
    return this.wordResize.bind(input);
  }

  bindSegmentRotateHandle(input: SegmentRotateBindInput): () => void {
    return this.segmentRotate.bind(input);
  }

  bindWordRotateHandle(input: WordRotateBindInput): () => void {
    return this.wordRotate.bind(input);
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  snapshot(): OverlayDragState | null {
    return this.dragState;
  }

  verticalGuides(): readonly SnapGuide[] {
    return this.snapResolver.verticalBands.map((band) => ({ center: band.center }));
  }

  horizontalGuides(): readonly SnapGuide[] {
    return this.snapResolver.horizontalBands.map((band) => ({ center: band.center }));
  }

  wordCenterGuide(): SnapGuide {
    const band = this.snapResolver.horizontalCenterBand();
    return { center: band.center };
  }

  scaler(): HTMLElement | null {
    return this.scalerElement;
  }

  isSessionActive(): boolean {
    return this.activeSession !== null;
  }

  activateSession(session: DragSession): void {
    session.attach({
      onMove: (event) => this.onActiveSessionMove(event),
      onUp: (event) => this.onActiveSessionUp(event),
      onCancel: () => this.cancelActiveSession(),
    });
    this.activeSession = session;
  }

  private onActiveSessionMove(event: PointerEvent): void {
    const session = this.activeSession;
    if (!session) return;
    if (!session.evaluateActivation(event.clientX, event.clientY)) return;
    const next = this.computeState(session, event.clientX, event.clientY);
    this.dragState = next;
    this.applyMoveSideEffects(session, next);
    this.emit();
  }

  private onActiveSessionUp(event: PointerEvent): void {
    const session = this.activeSession;
    if (!session) return;
    const wasDrag = session.activated;
    const finalState = wasDrag ? this.computeState(session, event.clientX, event.clientY) : null;
    if (finalState) {
      this.clickSuppressor.arm();
      this.commit(finalState);
    }
    this.cleanupGesture(session);
    session.dispose();
    this.activeSession = null;
    this.dragState = null;
    this.emit();
  }

  private cancelActiveSession(): void {
    const session = this.activeSession;
    if (!session) return;
    this.cleanupGesture(session);
    session.dispose();
    this.activeSession = null;
    this.dragState = null;
    this.emit();
  }

  private computeState(session: DragSession, clientX: number, clientY: number): OverlayDragState {
    const target = session.target;
    switch (target.kind) {
      case 'segment':         return this.segmentDrag.computeState(session, target, clientX, clientY);
      case 'word':            return this.wordDrag.computeState(session, target, clientX, clientY);
      case 'segment-resize':  return this.segmentResize.computeState(session, target, clientX, clientY);
      case 'word-resize':     return this.wordResize.computeState(session, target, clientX, clientY);
      case 'segment-rotate':  return this.segmentRotate.computeState(session, target, clientX, clientY);
      case 'word-rotate':     return this.wordRotate.computeState(session, target, clientX, clientY);
    }
  }

  private applyMoveSideEffects(session: DragSession, state: OverlayDragState): void {
    switch (state.kind) {
      case 'segment':         this.segmentDrag.applyMoveSideEffects(session, state); return;
      case 'word':            this.wordDrag.applyMoveSideEffects(); return;
      case 'segment-resize':  this.segmentResize.applyMoveSideEffects(session, state); return;
      case 'word-resize':     this.wordResize.applyMoveSideEffects(session, state); return;
      case 'segment-rotate':  this.segmentRotate.applyMoveSideEffects(session, state); return;
      case 'word-rotate':     this.wordRotate.applyMoveSideEffects(session, state); return;
    }
  }

  private commit(state: OverlayDragState): void {
    switch (state.kind) {
      case 'segment':         this.segmentDrag.commit(state); return;
      case 'word':            this.wordDrag.commit(state); return;
      case 'segment-resize':  this.segmentResize.commit(state); return;
      case 'word-resize':     this.wordResize.commit(state); return;
      case 'segment-rotate':  this.segmentRotate.commit(state); return;
      case 'word-rotate':     this.wordRotate.commit(state); return;
    }
  }

  private cleanupGesture(session: DragSession): void {
    const target: AnyDragTarget = session.target;
    switch (target.kind) {
      case 'segment':         this.segmentDrag.cleanupOnEnd(); return;
      case 'word':            this.wordDrag.cleanupOnEnd(); return;
      case 'segment-resize':  this.segmentResize.cleanupOnEnd(); return;
      case 'word-resize':     this.wordResize.cleanupOnEnd(); return;
      case 'segment-rotate':  this.segmentRotate.cleanupOnEnd(); return;
      case 'word-rotate':     this.wordRotate.cleanupOnEnd(); return;
    }
  }

  private emit(): void {
    for (const callback of this.subscribers) callback();
  }
}
