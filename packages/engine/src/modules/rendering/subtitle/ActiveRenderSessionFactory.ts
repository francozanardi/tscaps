import type { Document } from '@modules/document/Document';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import type { VideoFrameSource } from '@modules/rendering/types/VideoFrameSource';
import type { BaselineCssComposer } from '@modules/rendering/styles/BaselineCssComposer';
import { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import { SvgFilterLengthResolver } from '@modules/svg-filter/SvgFilterLengthResolver';
import { SegmentSubtreeHtmlBuilder } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { SegmentPaintRegionResolver } from '@modules/rendering/subtitle/SegmentPaintRegionResolver';
import { SegmentPaintRegionCache } from '@modules/rendering/subtitle/SegmentPaintRegionCache';
import { VideoFrameVarsBuilder } from '@modules/rendering/subtitle/VideoFrameVarsBuilder';
import { SvgFilterMaterializer } from '@modules/rendering/subtitle/SvgFilterMaterializer';
import { SegmentWrapperRenderer } from '@modules/rendering/subtitle/SegmentWrapperRenderer';
import { AnimationProbe } from '@modules/rendering/subtitle/AnimationProbe';
import { BatchPlanner } from '@modules/rendering/subtitle/BatchPlanner';
import { SpriteSheetCompositor } from '@modules/rendering/subtitle/SpriteSheetCompositor';
import { ActiveRenderSession } from '@modules/rendering/subtitle/ActiveRenderSession';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

/**
 * Assembles an `ActiveRenderSession` and its per-session collaborator
 * graph: animation probe, segment paint-region cache, video-frame
 * vars builder, segment wrapper renderer, batch planner, and sprite
 * sheet compositor.
 */
export class ActiveRenderSessionFactory {

  constructor(
    private readonly wordSplitter: WordSplitter,
    private readonly baselineCssComposer: BaselineCssComposer,
  ) {}

  create(
    doc: Document,
    styles: Readonly<Record<string, PreparedStyle>>,
    width: number,
    height: number,
    videoFrameSource: VideoFrameSource | null,
  ): ActiveRenderSession {
    const subtreeBuilder = new SegmentSubtreeHtmlBuilder(this.wordSplitter);
    const subtreeDecomposer = new SegmentSubtreeDecomposer();
    const paintRegionResolver = new SegmentPaintRegionResolver();
    const paintRegionCache = new SegmentPaintRegionCache();
    const filterMaterializer = new SvgFilterMaterializer(
      new SvgFilterScoper(),
      new SvgFilterLengthResolver(),
      height,
    );
    const videoFrameVarsBuilder = new VideoFrameVarsBuilder(
      subtreeBuilder,
      paintRegionResolver,
      paintRegionCache,
      width,
      height,
      videoFrameSource,
    );
    const wrapperRenderer = new SegmentWrapperRenderer(
      subtreeBuilder,
      subtreeDecomposer,
      filterMaterializer,
      videoFrameVarsBuilder,
      width,
      height,
    );
    const animationProbe = new AnimationProbe();
    const batchPlanner = new BatchPlanner(doc, styles, animationProbe);
    const spriteSheetCompositor = new SpriteSheetCompositor(
      styles,
      wrapperRenderer,
      this.baselineCssComposer,
      width,
      height,
    );
    return new ActiveRenderSession(
      batchPlanner,
      spriteSheetCompositor,
      animationProbe,
      paintRegionCache,
    );
  }
}
