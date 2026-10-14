import type { EditorStore } from '@core/editor/store/EditorStore';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import type { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import type { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import type { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import type { SetElementPlacementAction } from '@core/elements/actions/SetElementPlacementAction';
import type { SnapBand, SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import type { HorizontalPlacementResolver } from '@tscaps/engine';
import type { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import type { AlignmentGeometryResolver } from '@presentation/editor/services/AlignmentGeometryResolver';
import type { ElementAlignmentResolver } from '@presentation/editor/services/ElementAlignmentResolver';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import { SegmentDragPlanner } from '@presentation/editor/services/SegmentDragPlanner';
import type { CaptionContentBoxMeasurer } from '@presentation/editor/services/CaptionContentBoxMeasurer';
import type { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import type { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import type { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import type { NextClickSuppressor } from '@presentation/editor/services/NextClickSuppressor';
import type { ElementControlRange } from '@presentation/editor/services/ElementControlRange';
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
  SegmentCopyBindInput,
  SegmentDragTarget,
  SegmentResizeBindInput,
  SegmentRotateBindInput,
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
  SegmentCopyBindInput,
  WordBindInput,
  SegmentResizeBindInput,
  WordResizeBindInput,
  SegmentRotateBindInput,
  WordRotateBindInput,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Coordinates pointer-driven manipulations of the subtitle overlay
 * by dispatching to one gesture per kind (segment / word drag-to-
 * move, segment / word resize). Owns the single active drag session
 * — only one gesture is in flight at a time — plus the scaler ref,
 * the segment binding table that gestures consult, and the
 * subscriber list React reads through `snapshot`.
 *
 * Word and handle gestures attach their own pointerdown via
 * `bindWord` / `bindSegmentResizeHandle` / `bindWordResizeHandle`.
 * Segment drags start from a single delegated pointerdown on the
 * scaler instead: the segment's clickable surfaces (the scaler-level
 * hitzone ghost, plus word presses the word gesture declines and
 * lets bubble) all resolve through `data-tscaps-segment-id`, so one
 * listener covers them; `bindSegment` only registers geometry.
 * Gestures request a session via the `OverlayGestureHost` protocol
 * the controller implements.
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
    setElementPlacement: SetElementPlacementAction,
    styledElementCatalog: StyledElementCatalog,
    setElementField: SetElementFieldAction,
    private readonly snapResolver: SnapZoneResolver,
    horizontalPlacementResolver: HorizontalPlacementResolver,
    geometryResolver: DragGeometryResolver,
    alignmentGeometry: AlignmentGeometryResolver,
    baselineResolver: ElementAlignmentResolver,
    linkedSheetsSync: LinkedSheetsSync,
    contentBoxMeasurer: CaptionContentBoxMeasurer,
    resizeGeometry: ResizeGeometryResolver,
    rotationGeometry: RotationGeometryResolver,
    controlRange: ElementControlRange,
    transformPainter: DragTransformPainter,
    private readonly clickSuppressor: NextClickSuppressor,
    selectionController: OverlaySelectionController,
  ) {
    this.segmentDrag = new SegmentDragGesture(
      this, updateAlignment, setElementPlacement,
      snapResolver, horizontalPlacementResolver, geometryResolver, alignmentGeometry,
      new SegmentDragPlanner(editorStore, this.segmentBindings, linkedSheetsSync, baselineResolver),
      transformPainter,
    );
    this.wordDrag = new WordDragGesture(
      this, this.segmentBindings, editorStore, setElementPlacement,
      snapResolver, geometryResolver, contentBoxMeasurer, selectionController,
    );
    this.segmentResize = new SegmentResizeGesture(
      this, this.segmentBindings, editorStore, updateTypography,
      styledElementCatalog, setElementField, resizeGeometry, controlRange,
    );
    this.wordResize = new WordResizeGesture(
      this, styledElementCatalog, setElementField, resizeGeometry, controlRange,
    );
    this.segmentRotate = new SegmentRotateGesture(
      this, this.segmentBindings, editorStore, updateRotation,
      styledElementCatalog, setElementField, rotationGeometry,
    );
    this.wordRotate = new WordRotateGesture(
      this, editorStore, styledElementCatalog, setElementField, rotationGeometry,
    );
  }

  start(): void {
    // Word and handle gestures attach per-binding pointerdown listeners;
    // the segment-drag listener rides the scaler and installs in `setScaler`.
  }

  stop(): void {
    if (this.activeSession) this.cancelActiveSession();
    this.segmentBindings.clear();
    this.subscribers.clear();
    this.setScaler(null);
  }

  setScaler(element: HTMLElement | null): void {
    if (this.scalerElement) {
      this.scalerElement.removeEventListener('pointerdown', this.onScalerPointerDown);
    }
    this.scalerElement = element;
    if (element) element.addEventListener('pointerdown', this.onScalerPointerDown);
  }

  bindSegment(input: SegmentBindInput): () => void {
    const target: SegmentDragTarget = { kind: 'segment', ...input };
    this.segmentBindings.register(target);
    return () => this.segmentBindings.unregister(input.segmentId);
  }

  /**
   * Registers a copy of a segment's subtree so a drag moves it with the
   * original. A copy no drag knows about stays where the segment was
   * until the commit re-renders it, and jumps.
   */
  bindSegmentCopy(input: SegmentCopyBindInput): () => void {
    return this.segmentBindings.registerCopy(input.segmentId, input.wrapper);
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

  wordCenterGuide(): SnapBand {
    return this.snapResolver.horizontalCenterBand();
  }

  scaler(): HTMLElement | null {
    return this.scalerElement;
  }

  isSessionActive(): boolean {
    return this.activeSession !== null;
  }

  // Delegated segment-drag start. Bubble phase is load-bearing: surfaces
  // that claim the press for themselves (word drags, resize / rotate
  // handles) stop propagation on their own pointerdown, so whatever
  // still arrives here with a `data-tscaps-segment-id` ancestor is a
  // segment-move press. Positioned word hosts carry the attribute only
  // for selection resolution — a press on one must not move the whole
  // caption, so they are filtered out.
  private readonly onScalerPointerDown = (event: PointerEvent): void => {
    const pressed = event.target;
    if (!(pressed instanceof Element)) return;
    if (pressed.closest('.subtitle-overlay-positioned-word-host')) return;
    const hit = pressed.closest('[data-tscaps-segment-id]');
    if (!hit) return;
    const segmentId = hit.getAttribute('data-tscaps-segment-id')!;
    const binding = this.segmentBindings.get(segmentId);
    if (!binding) return;
    this.segmentDrag.tryStart(binding, event);
  };

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
