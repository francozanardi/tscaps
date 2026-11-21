import type { SubtitleFrame } from '@modules/rendering/SubtitleFrameRenderer';
import type { BatchPlanner } from '@modules/rendering/subtitle/BatchPlanner';
import type { SpriteSheetCompositor } from '@modules/rendering/subtitle/SpriteSheetCompositor';
import type { SegmentPaintRegionCache } from '@modules/rendering/subtitle/SegmentPaintRegionCache';
import type { ElementMeasurer } from '@modules/rendering/subtitle/ElementMeasurer';

/**
 * Per-document render session. Routes each `getFrames` batch through
 * the planner → compositor pipeline and clears the segment
 * paint-region cache on dispose.
 */
export class ActiveRenderSession {

  constructor(
    private readonly batchPlanner: BatchPlanner,
    private readonly spriteSheetCompositor: SpriteSheetCompositor,
    private readonly paintRegionCache: SegmentPaintRegionCache,
    private readonly elementMeasurer: ElementMeasurer,
  ) {}

  /**
   * Frames for as many of `timestamps` as one sprite sheet of
   * `maxTilesPerSheet` tiles per asset group can serve. The result
   * covers a prefix of the input — at least its first entry — so a
   * caller may offer more timestamps than any sheet could hold and
   * read back how far this one reached.
   */
  async getFrames(
    timestamps: ReadonlyArray<number>,
    maxTilesPerSheet: number,
  ): Promise<Array<SubtitleFrame | null>> {
    if (timestamps.length === 0) return [];
    const plan = await this.batchPlanner.plan(timestamps, maxTilesPerSheet);
    if (plan.groups.size === 0) return plan.assignments.map(() => null);
    const sprites = await this.spriteSheetCompositor.renderGroups(plan.groups);
    return this.spriteSheetCompositor.buildFrames(plan.assignments, sprites);
  }

  dispose(): void {
    this.paintRegionCache.clear();
    this.elementMeasurer.clear();
  }
}
