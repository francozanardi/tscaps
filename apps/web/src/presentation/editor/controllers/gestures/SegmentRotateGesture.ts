import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import type { SetSegmentStyleOverrideAction } from '@core/editor/actions/segments/SetSegmentStyleOverrideAction';
import type { SegmentStyleOverrides } from '@core/editor/domain/SegmentStyleOverrides';
import type { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type SegmentRotateBindInput,
  type SegmentRotateState,
  type SegmentRotateTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag the rotation icon on the selected segment to rotate
 * around the centre of its wrapper bounding box. Default writes the
 * sheet's rotation so every segment rotates together — the natural
 * model for captions — and clears the dragged segment's per-segment
 * rotation override on first commit so it stops standing still while
 * its siblings spin around. Holding Alt at pointerdown flips the
 * gesture: writes land on the override only.
 */
export class SegmentRotateGesture {
  /** Effective rotation captured at pointerdown, used as the base the
   *  per-tick delta is added to. `null` between gestures. */
  private originalRotationDeg: number | null = null;
  /** True when Alt was held at pointerdown: writes land on the
   *  segment override instead of the sheet. */
  private scopedToSegment = false;
  /** True after the first non-scoped write has cleared the dragged
   *  segment's override, so we don't issue a no-op clear every tick. */
  private clearedSegmentOverride = false;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly segments: SegmentBindingRegistry,
    private readonly editorStore: EditorStore,
    private readonly updateRotation: UpdateRotationAction,
    private readonly setSegmentStyleOverride: SetSegmentStyleOverrideAction,
    private readonly rotationGeometry: RotationGeometryResolver,
  ) {}

  bind(input: SegmentRotateBindInput): () => void {
    const target: SegmentRotateTarget = { kind: 'segment-rotate', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: SegmentRotateTarget, clientX: number, clientY: number): SegmentRotateState {
    const original = this.originalRotationDeg ?? 0;
    const pivotX = session.anchorRect.left + session.anchorRect.width / 2;
    const pivotY = session.anchorRect.top + session.anchorRect.height / 2;
    const delta = this.rotationGeometry.deltaDegrees(
      pivotX, pivotY, session.startClientX, session.startClientY, clientX, clientY,
    );
    const snap = this.rotationGeometry.snap(original + delta);
    return {
      kind: 'segment-rotate',
      segmentId: target.segmentId,
      rotationDeg: snap.value,
      snappedAngleDeg: snap.snappedTo,
      scopedToSegment: this.scopedToSegment,
    };
  }

  applyMoveSideEffects(_session: DragSession, state: SegmentRotateState): void {
    this.writeRotation(state.segmentId, state.rotationDeg);
  }

  commit(state: SegmentRotateState): void {
    this.writeRotation(state.segmentId, state.rotationDeg);
  }

  cleanupOnEnd(): void {
    // `scopedToSegment` and `clearedSegmentOverride` are deliberately NOT
    // reset here — the host calls `cleanupOnEnd` BEFORE the final
    // `commit`, and the commit must see the same scope as the move
    // ticks. Both are re-initialised at the next `tryStart`.
    this.originalRotationDeg = null;
  }

  private writeRotation(segmentId: string, rotationDeg: number): void {
    if (this.scopedToSegment) {
      const previous = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId);
      this.setSegmentStyleOverride.execute(segmentId, { ...previous, rotation: rotationDeg });
      return;
    }
    if (!this.clearedSegmentOverride) {
      this.clearSegmentRotationOverride(segmentId);
      this.clearedSegmentOverride = true;
    }
    this.updateRotation.execute({ angleDeg: rotationDeg });
  }

  private clearSegmentRotationOverride(segmentId: string): void {
    const previous = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId);
    if (previous.rotation === undefined) return;
    const next: Record<string, unknown> = { ...previous };
    delete next.rotation;
    this.setSegmentStyleOverride.execute(segmentId, next as SegmentStyleOverrides);
  }

  private tryStart(target: SegmentRotateTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const segmentBinding = this.segments.get(target.segmentId);
    if (!segmentBinding) return;
    const activeSheet = this.editorStore.activeSheet();
    if (!activeSheet) return;
    event.stopPropagation();
    this.scopedToSegment = event.altKey;
    this.clearedSegmentOverride = false;
    this.originalRotationDeg = this.readBaselineRotation(target.segmentId, activeSheet.rotationConfig.angleDeg);
    const session = new DragSession(
      target,
      segmentBinding.wrapper.getBoundingClientRect(),
      scaler.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }

  /** Per-segment override when present (latched user choice), else the
   *  sheet's rotation (the effective baseline the user is rotating away
   *  from). Either way the result is the angle the segment currently
   *  appears at on screen — the per-tick delta is added on top. */
  private readBaselineRotation(segmentId: string, sheetRotationDeg: number): number {
    const override = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId).rotation;
    return override ?? sheetRotationDeg;
  }
}
