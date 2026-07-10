import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import type { SetSegmentStyleOverrideAction } from '@core/captions/actions/segments/SetSegmentStyleOverrideAction';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import type { FontSizeBounds } from '@presentation/editor/services/FontSizeBounds';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type SegmentResizeBindInput,
  type SegmentResizeState,
  type SegmentResizeTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag a corner handle on the selected segment to scale
 * typography. Default rescales the sheet's font-size so every segment
 * grows together — the natural model for captions — and clears the
 * dragged segment's per-segment font-size override on first commit so
 * it stops standing still while its siblings scale around it. Holding
 * Alt at pointerdown flips the gesture: writes land on the override
 * only.
 */
export class SegmentResizeGesture {
  /** Effective font-size captured at pointerdown so per-move commits
   *  scale the original value linearly with the cursor instead of
   *  compounding each tick. `null` between gestures. */
  private originalFontSize: number | null = null;
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
    private readonly updateTypography: UpdateTypographyAction,
    private readonly setSegmentStyleOverride: SetSegmentStyleOverrideAction,
    private readonly resizeGeometry: ResizeGeometryResolver,
    private readonly fontSizeBounds: FontSizeBounds,
  ) {}

  bind(input: SegmentResizeBindInput): () => void {
    const target: SegmentResizeTarget = { kind: 'segment-resize', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: SegmentResizeTarget, clientX: number, clientY: number): SegmentResizeState {
    const original = this.originalFontSize ?? 0;
    const { dx, dy } = session.delta(clientX, clientY);
    const scale = this.resizeGeometry.scale(session.anchorRect, target.corner, dx, dy);
    const fontSize = this.fontSizeBounds.clamp(original * scale);
    return { kind: 'segment-resize', segmentId: target.segmentId, fontSize, scopedToSegment: this.scopedToSegment };
  }

  applyMoveSideEffects(_session: DragSession, state: SegmentResizeState): void {
    this.writeFontSize(state.segmentId, state.fontSize);
  }

  commit(state: SegmentResizeState): void {
    // One last write so the release-cursor position matches the
    // committed value exactly; the action's coalescing key collapses
    // this with the per-tick updates into a single undo step.
    this.writeFontSize(state.segmentId, state.fontSize);
  }

  cleanupOnEnd(): void {
    // `scopedToSegment` and `clearedSegmentOverride` are deliberately NOT
    // reset here — the host calls `cleanupOnEnd` BEFORE the final
    // `commit`, and the commit must see the same scope as the move
    // ticks. Both are re-initialised at the next `tryStart`.
    this.originalFontSize = null;
  }

  private writeFontSize(segmentId: string, fontSize: number): void {
    if (this.scopedToSegment) {
      const previous = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId);
      this.setSegmentStyleOverride.execute(segmentId, { ...previous, fontSize });
      return;
    }
    if (!this.clearedSegmentOverride) {
      this.clearSegmentFontSizeOverride(segmentId);
      this.clearedSegmentOverride = true;
    }
    this.updateTypography.execute({ fontSize });
  }

  private clearSegmentFontSizeOverride(segmentId: string): void {
    const previous = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId);
    if (previous.fontSize === undefined) return;
    const next: Record<string, unknown> = { ...previous };
    delete next.fontSize;
    this.setSegmentStyleOverride.execute(segmentId, next as SegmentStyleOverrides);
  }

  private tryStart(target: SegmentResizeTarget, event: PointerEvent): void {
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
    this.originalFontSize = this.readBaselineFontSize(target.segmentId, activeSheet.typographyConfig.fontSize);
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
   *  sheet's typography font-size (the effective baseline the user is
   *  scaling away from). Result is the size the segment currently
   *  renders at — the per-tick scale multiplies this. */
  private readBaselineFontSize(segmentId: string, sheetFontSize: number): number {
    const override = this.editorStore.snapshot().segmentOverrides.getStyle(segmentId).fontSize;
    return override ?? sheetFontSize;
  }
}
