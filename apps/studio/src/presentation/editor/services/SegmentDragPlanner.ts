import type { AlignmentConfig, TextDirection } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { BoxSize } from '@presentation/editor/services/AlignmentGeometryResolver';
import type { ElementAlignmentResolver } from '@presentation/editor/services/ElementAlignmentResolver';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import type { SegmentDragTarget } from '@presentation/editor/controllers/OverlayManipulationTypes';

/** One segment a drag repaints, with the geometry it starts from. */
export interface SegmentDragPaintTarget {
  /** Every element the drag moves for this segment: its wrapper, then the wrappers of its copies. */
  readonly painted: ReadonlyArray<HTMLElement>;
  /** Effective alignment the segment sits at when the drag begins. */
  readonly alignmentBefore: AlignmentConfig;
  /**
   * The segment's own position offsets that survive the commit and
   * re-apply over it. Empty when the drag itself rewrites them.
   */
  readonly keptOverride: Partial<AlignmentConfig>;
  readonly box: BoxSize;
  readonly textDirection: TextDirection;
}

/** Everything a segment drag needs to know about the frame it moves in. */
export interface SegmentDragPlan {
  /** Sheet a sheet-scoped commit writes to. */
  readonly sheet: Sheet;
  readonly frame: BoxSize;
  /** The segment under the cursor; also the first entry of `targets`. */
  readonly dragged: SegmentDragPaintTarget;
  readonly targets: ReadonlyArray<SegmentDragPaintTarget>;
}

/**
 * Snapshots, at pointerdown, which segments a segment drag is going to
 * move and where each of them starts.
 *
 * The set is not "every segment on screen". A sheet-scoped commit lands
 * on the dragged segment's sheet and its link-group siblings only, so
 * a segment from any other sheet has to stand still. Within the reached
 * sheets, a segment that pins an axis through its own offset override
 * keeps that axis wherever the user left it, and only follows a change
 * of anchor. A segment-scoped drag moves nothing but the dragged
 * segment.
 *
 * Sizes are measured once, here: a caption's layout box does not change
 * under a drag, and re-measuring every segment on every pointermove
 * would force a layout flush per tick.
 */
export class SegmentDragPlanner {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly segments: SegmentBindingRegistry,
    private readonly linkedSheetsSync: LinkedSheetsSync,
    private readonly baselineResolver: ElementAlignmentResolver,
  ) {}

  /**
   * Returns the plan for dragging `dragged` inside a `frame`-sized
   * video region, or null when the dragged segment's sheet is gone from
   * the current state. `scopedToSegment` is the Alt-latched scope: true
   * writes to the segment's own offsets, false to its sheet.
   */
  plan(dragged: SegmentDragTarget, frame: BoxSize, scopedToSegment: boolean): SegmentDragPlan | null {
    const { sheets, elementStyles } = this.editorStore.snapshot();
    const sheet = this.editorStore.sheet(dragged.sheetId);
    if (!sheet) return null;

    const draggedTarget = this.paintTargetFor(dragged, sheet, elementStyles, true);
    const targets = [draggedTarget];
    if (!scopedToSegment) {
      const reachedSheetIds = this.linkedSheetsSync.styleEditReach(sheet, sheets);
      for (const binding of this.segments.all()) {
        if (binding.segmentId === dragged.segmentId) continue;
        if (!reachedSheetIds.has(binding.sheetId)) continue;
        const owner = this.editorStore.sheet(binding.sheetId);
        if (!owner) continue;
        targets.push(this.paintTargetFor(binding, owner, elementStyles, false));
      }
    }
    return { sheet, frame, dragged: draggedTarget, targets };
  }

  private paintTargetFor(
    binding: SegmentDragTarget,
    sheet: Sheet,
    elementStyles: ElementStyles,
    offsetsRewritten: boolean,
  ): SegmentDragPaintTarget {
    return {
      painted: [binding.wrapper, ...this.segments.copiesOf(binding.segmentId)],
      alignmentBefore: this.baselineResolver.segmentEffectiveAlignment(sheet, binding.segmentId, elementStyles),
      keptOverride: offsetsRewritten ? {} : elementStyles.placementOf(binding.segmentId) ?? {},
      box: { width: binding.wrapper.offsetWidth, height: binding.wrapper.offsetHeight },
      textDirection: sheet.textDirection,
    };
  }
}
