import type { AlignmentConfig } from '@tscaps/engine';
import type { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import type { SetElementPlacementAction } from '@core/elements/actions/SetElementPlacementAction';
import type { SnapBandsInFrame, SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import type { HorizontalPlacementResolver } from '@tscaps/engine';
import type { DragCentroid, DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import type { AlignmentGeometryResolver } from '@presentation/editor/services/AlignmentGeometryResolver';
import type { SegmentDragPlan, SegmentDragPlanner } from '@presentation/editor/services/SegmentDragPlanner';
import type { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type SegmentDragState,
  type SegmentDragTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag a segment to commit a new alignment on its sheet.
 *
 * Visual feedback is the position each affected segment will actually
 * land on once the drop commits, painted per segment: the segments that
 * share the alignment travel with the dragged one, the rest stand still,
 * and a snapped drag shows the snapped landing rather than the raw
 * cursor. Holding Alt at pointerdown flips the gesture: writes land on
 * the dragged segment's offset override only, the sheet's anchor stays
 * inherited, and no other segment moves.
 */
export class SegmentDragGesture {
  /** True when Alt was held at pointerdown: writes land on the
   *  segment offset override instead of the sheet's alignment. */
  private scopedToSegment = false;
  /** Geometry snapshot of the segments in flight; `null` between gestures. */
  private activePlan: SegmentDragPlan | null = null;
  /** Bands the dragged box can land on; fixed for the gesture, its size being fixed too. */
  private activeBands: SnapBandsInFrame | null = null;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly updateAlignment: UpdateAlignmentAction,
    private readonly setElementPlacement: SetElementPlacementAction,
    private readonly snapResolver: SnapZoneResolver,
    private readonly horizontalPlacementResolver: HorizontalPlacementResolver,
    private readonly geometryResolver: DragGeometryResolver,
    private readonly alignmentGeometry: AlignmentGeometryResolver,
    private readonly planner: SegmentDragPlanner,
    private readonly transformPainter: DragTransformPainter,
  ) {}

  /**
   * Starts a drag session for `target` from a primary-button
   * pointerdown. No-op when another gesture already owns the active
   * session, no scaler is mounted, or the segment's sheet is gone.
   * Latches the Alt modifier: held at pointerdown, the whole gesture
   * writes to the segment's offset override instead of the sheet
   * alignment.
   */
  tryStart(target: SegmentDragTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const scalerRect = scaler.getBoundingClientRect();
    const plan = this.planner.plan(target, { width: scalerRect.width, height: scalerRect.height }, event.altKey);
    if (!plan) return;
    this.scopedToSegment = event.altKey;
    this.activePlan = plan;
    this.activeBands = this.snapResolver.bandsFor({
      widthFrac: plan.dragged.box.width / plan.frame.width,
      heightFrac: plan.dragged.box.height / plan.frame.height,
    });
    const session = new DragSession(
      target,
      target.wrapper.getBoundingClientRect(),
      scalerRect,
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }

  computeState(session: DragSession, target: SegmentDragTarget, clientX: number, clientY: number): SegmentDragState {
    const plan = this.planInFlight();
    const { dx, dy } = session.delta(clientX, clientY);
    const centroid = this.centroidOf(plan, dx, dy);
    const resolution = this.scopedToSegment
      ? this.resolveScoped(plan, centroid)
      : this.snapResolver.resolve(
          centroid.centroidXFrac,
          centroid.centroidYFrac,
          centroid.boxWidthFrac,
          centroid.boxHeightFrac,
        );
    const bands = this.bandsInFlight();
    return {
      kind: 'segment',
      segmentId: target.segmentId,
      vertical: resolution.vertical,
      horizontal: resolution.horizontal,
      verticalGuides: bands.vertical,
      horizontalGuides: bands.horizontal,
      scopedToSegment: this.scopedToSegment,
    };
  }

  applyMoveSideEffects(_session: DragSession, state: SegmentDragState): void {
    const plan = this.planInFlight();
    const committed = this.committedAlignment(state);
    for (const target of plan.targets) {
      const shift = this.alignmentGeometry.shift(
        target.alignmentBefore,
        { ...committed, ...target.keptOverride },
        target.box,
        plan.frame,
        target.textDirection,
      );
      for (const element of target.painted) this.transformPainter.applyTranslate(element, shift.deltaX, shift.deltaY);
    }
  }

  commit(state: SegmentDragState): void {
    if (state.scopedToSegment) {
      this.commitSegmentOffset(state);
      return;
    }
    this.clearSegmentOffsetOverride(state.segmentId);
    // A position placed with a pointer is a position on the screen, so the
    // commit stores it in screen terms even when the template declared its
    // anchor relative to reading order.
    this.updateAlignment.execute(this.planInFlight().sheet.id, this.committedAlignment(state));
  }

  cleanupOnEnd(): void {
    for (const target of this.activePlan?.targets ?? []) {
      for (const element of target.painted) this.transformPainter.clear(element);
    }
    this.activePlan = null;
    this.activeBands = null;
  }

  // The host activates a session only after `tryStart` has stored a
  // plan, and drops the session before `cleanupOnEnd` clears it.
  private planInFlight(): SegmentDragPlan {
    if (!this.activePlan) throw new Error('Segment drag ran outside an active session');
    return this.activePlan;
  }

  private bandsInFlight(): SnapBandsInFrame {
    if (!this.activeBands) throw new Error('Segment drag ran outside an active session');
    return this.activeBands;
  }

  // Derived from the segment's alignment rather than from a measured
  // rect: the wrapper carries the segment's rotation and its
  // behind-actor lift, and both would bake into the committed anchor.
  private centroidOf(plan: SegmentDragPlan, deltaX: number, deltaY: number): DragCentroid {
    const { alignmentBefore, box, textDirection } = plan.dragged;
    const origin = this.alignmentGeometry.origin(alignmentBefore, box, plan.frame, textDirection);
    return this.geometryResolver.centroidFromOrigin(origin, box, plan.frame, deltaX, deltaY);
  }

  private committedAlignment(state: SegmentDragState): AlignmentConfig {
    return {
      verticalAlign: state.vertical.align,
      verticalOffset: state.vertical.offset,
      horizontalAlign: state.horizontal.align,
      horizontalOffset: state.horizontal.offset,
    };
  }

  // Anchored against where the segment already sits, not against the
  // sheet: a segment moved this way before carries its own anchor, and
  // re-reading the sheet's would drop it somewhere it never was.
  private resolveScoped(plan: SegmentDragPlan, centroid: DragCentroid): {
    vertical: SegmentDragState['vertical'];
    horizontal: SegmentDragState['horizontal'];
  } {
    const anchor = plan.dragged.alignmentBefore;
    return this.snapResolver.resolveForAnchor(
      anchor.verticalAlign,
      this.horizontalPlacementResolver.resolve(anchor.horizontalAlign, anchor.horizontalOffset, plan.dragged.textDirection).side,
      centroid.centroidXFrac,
      centroid.centroidYFrac,
      centroid.boxWidthFrac,
      centroid.boxHeightFrac,
    );
  }

  private commitSegmentOffset(state: SegmentDragState): void {
    this.setElementPlacement.execute(state.segmentId, 'segment', {
      verticalAlign: state.vertical.align,
      verticalOffset: state.vertical.offset,
      horizontalAlign: state.horizontal.align,
      horizontalOffset: state.horizontal.offset,
    });
  }

  private clearSegmentOffsetOverride(segmentId: string): void {
    this.setElementPlacement.clear(segmentId, 'segment');
  }
}
