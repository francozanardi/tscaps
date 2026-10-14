import type { Document } from '@modules/document/Document';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import type { WordFragmenter } from '@modules/bidi/WordFragmenter';
import { HorizontalSideResolver } from '@modules/bidi/HorizontalSideResolver';
import { HorizontalPlacementResolver } from '@modules/rendering/HorizontalPlacementResolver';
import type { VideoFrameSource } from '@modules/rendering/types/VideoFrameSource';
import type { BaselineCssComposer } from '@modules/rendering/styles/BaselineCssComposer';
import { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import { SvgFilterLengthResolver } from '@modules/svg-filter/SvgFilterLengthResolver';
import { SvgFilterDefsRenderer } from '@modules/svg-filter/SvgFilterDefsRenderer';
import { SegmentSubtreeHtmlBuilder } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { SegmentPaintRegionResolver } from '@modules/rendering/subtitle/SegmentPaintRegionResolver';
import { SegmentPaintRegionCache } from '@modules/rendering/subtitle/SegmentPaintRegionCache';
import { VideoFrameVarsBuilder } from '@modules/rendering/subtitle/VideoFrameVarsBuilder';
import { SegmentAnchorVarsBuilder } from '@modules/rendering/subtitle/SegmentAnchorVarsBuilder';
import { ElementWidthMeasurer } from '@modules/rendering/subtitle/ElementWidthMeasurer';
import { SvgFilterMaterializer } from '@modules/rendering/subtitle/SvgFilterMaterializer';
import { SvgFilterStateFingerprint } from '@modules/rendering/subtitle/SvgFilterStateFingerprint';
import { SegmentWrapperRenderer } from '@modules/rendering/subtitle/SegmentWrapperRenderer';
import { CssKeyframesScanner } from '@modules/css/CssKeyframesScanner';
import type { AnimationStateFingerprint, AnimationStateFingerprintStrategy } from '@modules/rendering/subtitle/AnimationStateFingerprint';
import { KeyframeScanAnimationStateFingerprint } from '@modules/rendering/subtitle/KeyframeScanAnimationStateFingerprint';
import { SubtreeMountAnimationStateFingerprint } from '@modules/rendering/subtitle/SubtreeMountAnimationStateFingerprint';
import { UnknownAnimationStateFingerprint } from '@modules/rendering/subtitle/UnknownAnimationStateFingerprint';
import { SubtreeAnimationSupport } from '@modules/rendering/subtitle/SubtreeAnimationSupport';
import { BatchPlanner } from '@modules/rendering/subtitle/BatchPlanner';
import { SpriteSheetCompositor } from '@modules/rendering/subtitle/SpriteSheetCompositor';
import { ActiveRenderSession } from '@modules/rendering/subtitle/ActiveRenderSession';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { CaptionLayer } from '@modules/rendering/types/CaptionLayer';

/**
 * Assembles an `ActiveRenderSession` and its per-session collaborator
 * graph: animation state fingerprint, segment paint-region cache, video-frame
 * vars builder, segment wrapper renderer, batch planner, and sprite
 * sheet compositor.
 */
export class ActiveRenderSessionFactory {

  constructor(
    private readonly wordSplitter: WordSplitter,
    private readonly wordFragmenter: WordFragmenter,
    private readonly baselineCssComposer: BaselineCssComposer,
    private readonly animationStrategy: AnimationStateFingerprintStrategy,
    private readonly layer: CaptionLayer,
  ) {}

  create(
    doc: Document,
    styles: Readonly<Record<string, PreparedStyle>>,
    width: number,
    height: number,
    videoFrameSource: VideoFrameSource | null,
  ): ActiveRenderSession {
    const subtreeBuilder = new SegmentSubtreeHtmlBuilder(this.wordSplitter, this.wordFragmenter);
    const subtreeDecomposer = new SegmentSubtreeDecomposer();
    const paintRegionResolver = new SegmentPaintRegionResolver();
    const paintRegionCache = new SegmentPaintRegionCache();
    const elementWidthMeasurer = new ElementWidthMeasurer(subtreeBuilder, width, height);
    const filterDefsRenderer = new SvgFilterDefsRenderer(new SvgFilterScoper(), new SvgFilterLengthResolver());
    const filterMaterializer = new SvgFilterMaterializer(filterDefsRenderer, height);
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
      new SegmentAnchorVarsBuilder(),
      elementWidthMeasurer,
      new HorizontalPlacementResolver(new HorizontalSideResolver()),
      width,
      height,
      this.layer,
    );
    const batchPlanner = new BatchPlanner(
      doc,
      styles,
      this.buildAnimationFingerprint(wrapperRenderer, width, height),
      new SvgFilterStateFingerprint(filterDefsRenderer, height),
      subtreeDecomposer,
      this.layer,
    );
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
      paintRegionCache,
      elementWidthMeasurer,
    );
  }

  private buildAnimationFingerprint(
    wrapperRenderer: SegmentWrapperRenderer,
    width: number,
    height: number,
  ): AnimationStateFingerprint {
    if (this.animationStrategy === 'none') return new UnknownAnimationStateFingerprint();
    if (this.animationStrategy === 'subtree-mount') {
      return new SubtreeMountAnimationStateFingerprint(wrapperRenderer, new SubtreeAnimationSupport(), width, height);
    }
    return new KeyframeScanAnimationStateFingerprint(new CssKeyframesScanner());
  }
}
