import type { AlignmentConfig } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import type { SetSegmentStyleOverrideAction } from '@core/captions/actions/segments/SetSegmentStyleOverrideAction';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import type { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import type { DragTransformPainter } from '@presentation/editor/services/DragTransformPainter';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type SegmentBindInput,
  type SegmentDragState,
  type SegmentDragTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag a segment to commit a new sheet-level alignment.
 * Visual feedback during the drag is a CSS translate painted onto
 * every segment wrapper (the sibling segments share the alignment),
 * cleared on release before the commit lands. Holding Alt at
 * pointerdown flips the gesture: writes land on the dragged segment's
 * offset override only, the sheet's anchor stays inherited, and only
 * the dragged wrapper paints during the drag.
 */
export class SegmentDragGesture {
  /** True when Alt was held at pointerdown: writes land on the
   *  segment offset override instead of the sheet's alignment. */
  private scopedToSegment = false;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly segments: SegmentBindingRegistry,
    private readonly editorStore: EditorStore,
    private readonly updateAlignment: UpdateAlignmentAction,
    private readonly setSegmentStyleOverride: SetSegmentStyleOverrideAction,
    private readonly snapResolver: SnapZoneResolver,
    private readonly geometryResolver: DragGeometryResolver,
    private readonly transformPainter: DragTransformPainter,
  ) {}

  bind(input: SegmentBindInput): () => void {
    const target: SegmentDragTarget = { kind: 'segment', ...input };
    this.segments.register(target);
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.hitzone.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.hitzone.removeEventListener('pointerdown', onPointerDown);
      this.segments.unregister(target.segmentId);
    };
  }

  computeState(session: DragSession, target: SegmentDragTarget, clientX: number, clientY: number): SegmentDragState {
    const { dx, dy } = session.delta(clientX, clientY);
    const centroid = this.geometryResolver.centroid(session.anchorRect, session.scalerRect, dx, dy);
    const resolution = this.scopedToSegment
      ? this.resolveScoped(centroid)
      : this.snapResolver.resolve(
          centroid.centroidXFrac,
          centroid.centroidYFrac,
          centroid.boxWidthFrac,
          centroid.boxHeightFrac,
        );
    return {
      kind: 'segment',
      segmentId: target.segmentId,
      deltaX: dx,
      deltaY: dy,
      vertical: resolution.vertical,
      horizontal: resolution.horizontal,
      scopedToSegment: this.scopedToSegment,
    };
  }

  applyMoveSideEffects(_session: DragSession, state: SegmentDragState): void {
    if (state.scopedToSegment) {
      const binding = this.segments.get(state.segmentId);
      if (!binding) return;
      this.transformPainter.applyTranslate([binding.wrapper], state.deltaX, state.deltaY);
      return;
    }
    this.transformPainter.applyTranslate(this.wrappers(), state.deltaX, state.deltaY);
  }

  commit(state: SegmentDragState): void {
    if (state.scopedToSegment) {
      this.commitSegmentOffset(state);
      return;
    }
    this.clearSegmentOffsetOverride(state.segmentId);
    const alignment: AlignmentConfig = {
      verticalAlign: state.vertical.align,
      verticalOffset: state.vertical.offset,
      horizontalAlign: state.horizontal.align,
      horizontalOffset: state.horizontal.offset,
    };
    this.updateAlignment.execute(alignment);
  }

  cleanupOnEnd(): void {
    this.transformPainter.clear(this.wrappers());
  }

  private resolveScoped(centroid: ReturnType<DragGeometryResolver['centroid']>): {
    vertical: SegmentDragState['vertical'];
    horizontal: SegmentDragState['horizontal'];
  } {
    const sheet = this.editorStore.activeSheet();
    const anchor = sheet?.alignmentConfig;
    if (!anchor) {
      return this.snapResolver.resolve(
        centroid.centroidXFrac,
        centroid.centroidYFrac,
        centroid.boxWidthFrac,
        centroid.boxHeightFrac,
      );
    }
    return this.snapResolver.resolveForAnchor(
      anchor.verticalAlign,
      anchor.horizontalAlign,
      centroid.centroidXFrac,
      centroid.centroidYFrac,
      centroid.boxWidthFrac,
      centroid.boxHeightFrac,
    );
  }

  private commitSegmentOffset(state: SegmentDragState): void {
    const previous = this.editorStore.snapshot().segmentOverrides.getStyle(state.segmentId);
    this.setSegmentStyleOverride.execute(state.segmentId, {
      ...previous,
      verticalOffset: state.vertical.offset,
      horizontalOffset: state.horizontal.offset,
    });
  }

  private clearSegmentOffsetOverride(segmentId: string): void {
    const previous = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId);
    if (previous.verticalOffset === undefined && previous.horizontalOffset === undefined) return;
    const next: Record<string, unknown> = { ...previous };
    delete next.verticalOffset;
    delete next.horizontalOffset;
    this.setSegmentStyleOverride.execute(segmentId, next as SegmentStyleOverrides);
  }

  private *wrappers(): IterableIterator<HTMLElement> {
    for (const target of this.segments.all()) yield target.wrapper;
  }

  private tryStart(target: SegmentDragTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    this.scopedToSegment = event.altKey;
    const session = new DragSession(
      target,
      target.wrapper.getBoundingClientRect(),
      scaler.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }
}
