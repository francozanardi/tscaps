import type { SubtitleFrame } from '@modules/rendering/SubtitleFrameRenderer';
import type { BatchPlanner } from '@modules/rendering/subtitle/BatchPlanner';
import type { SpriteSheetCompositor } from '@modules/rendering/subtitle/SpriteSheetCompositor';
import type { AnimationProbe } from '@modules/rendering/subtitle/AnimationProbe';
import type { SegmentPaintRegionCache } from '@modules/rendering/subtitle/SegmentPaintRegionCache';

/**
 * Per-document render session. Routes each `getFrames` batch through
 * the planner → compositor pipeline and clears the animation-timing
 * cache and segment paint-region cache on dispose.
 */
export class ActiveRenderSession {

  constructor(
    private readonly batchPlanner: BatchPlanner,
    private readonly spriteSheetCompositor: SpriteSheetCompositor,
    private readonly animationProbe: AnimationProbe,
    private readonly paintRegionCache: SegmentPaintRegionCache,
  ) {}

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    if (timestamps.length === 0) return [];
    const plan = this.batchPlanner.plan(timestamps);
    if (plan.groups.size === 0) return timestamps.map(() => null);
    const sprites = await this.spriteSheetCompositor.renderGroups(plan.groups);
    return this.spriteSheetCompositor.buildFrames(plan.assignments, sprites);
  }

  dispose(): void {
    this.animationProbe.clear();
    this.paintRegionCache.clear();
  }
}
