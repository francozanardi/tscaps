import type { Segment } from '@modules/document/Segment';
import { CssVariable } from '@modules/document/CssVariable';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { VideoFrameSource, VideoFrameRegion } from '@modules/rendering/types/VideoFrameSource';
import type { SegmentSubtreeHtmlBuilder } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import type { SegmentPaintRegionResolver, SegmentAnchorPlacement } from '@modules/rendering/subtitle/SegmentPaintRegionResolver';
import type { SegmentPaintRegionCache } from '@modules/rendering/subtitle/SegmentPaintRegionCache';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

const NO_EXCLUDED_WORDS: ReadonlySet<string> = new Set();

// Safety bleed applied to the painted region for video-frame styles
// that don't declare a `rendering.padding`. 0.25em ≈ enough to cover
// a typical text-shadow, kept narrow so the crop still pays off.
const UNDECLARED_PADDING_SAFETY_EM = 0.25;

/**
 * Builds the inline-style map driving the video-frame backdrop for
 * one segment: the JPEG data URL holding the painted region of the
 * underlying frame, plus the region's pixel size and offset within
 * the segment's anchor box. Caches paint regions per
 * `(kind, segmentId)` so the JPEG crop is only measured once per
 * segment.
 *
 * Returns an empty map for styles that don't consume the video
 * frame.
 */
export class VideoFrameVarsBuilder {

  constructor(
    private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder,
    private readonly paintRegionResolver: SegmentPaintRegionResolver,
    private readonly paintRegionCache: SegmentPaintRegionCache,
    private readonly width: number,
    private readonly height: number,
    private readonly videoFrameSource: VideoFrameSource | null,
  ) {}

  async build(
    style: PreparedStyle,
    seg: Segment,
    placement: SegmentAnchorPlacement,
    t: number,
  ): Promise<InlineStyleMap> {
    if (!style.rendering.videoFrame.required) return {};
    const region = this.resolvePaintRegion(style, seg, placement);
    // Offset vars assume the consuming element is a direct child of
    // the wrapper: `%` resolves against the wrapper. The region.x/y
    // bias positions the layer so the cropped frame's (0,0) lands on
    // viewport (region.x, region.y); when no crop applies the bias
    // is zero and the layer covers the full viewport.
    return {
      [CssVariable.VIDEO_FRAME]: `url("${await this.videoFrameSource!.getFrameAt(t, style.rendering.videoFrame.jpegQuality, region)}")`,
      [CssVariable.SUBTITLE_REGION_WIDTH]: `${region.width}px`,
      [CssVariable.SUBTITLE_REGION_HEIGHT]: `${region.height}px`,
      [CssVariable.SUBTITLE_REGION_X]: `calc(${placement.hAnchorPct}% - ${placement.xPx - region.x}px)`,
      [CssVariable.SUBTITLE_REGION_Y]: `calc(${placement.vAnchorPct}% - ${placement.yPx - region.y}px)`,
    };
  }

  /**
   * The tight-crop optimization assumes every word stays inside the
   * segment's in-flow bounding box. As soon as a word is
   * repositioned outside that bbox, the same crop leaves its
   * video-frame backdrop sampling pixels that aren't in the JPEG
   * payload. Falling back to the full viewport for those segments
   * restores correctness; the optimization recovers automatically
   * the moment the override is reset.
   */
  private resolvePaintRegion(
    style: PreparedStyle,
    seg: Segment,
    placement: SegmentAnchorPlacement,
  ): VideoFrameRegion {
    return this.paintRegionCache.getOrCompute(style.kind, seg.id, () =>
      this.hasPositionedWord(seg, style.wordOverrides) || this.hasPositionedDecoration(seg, style)
        ? { x: 0, y: 0, width: this.width, height: this.height }
        : this.measureSegmentPaintRegion(style, seg, placement),
    );
  }

  private measureSegmentPaintRegion(
    style: PreparedStyle,
    seg: Segment,
    placement: SegmentAnchorPlacement,
  ): VideoFrameRegion {
    const segmentInlineStylesOverride = style.segmentOverrides.get(seg.id)?.inlineStyles;
    const baseInlineStyles: InlineStyleMap = segmentInlineStylesOverride
      ? { ...style.inlineStyles, ...segmentInlineStylesOverride }
      : style.inlineStyles;
    const segmentHtml = this.subtreeBuilder.buildSegmentSubtree(
      {
        scopeClass: style.scopeClass,
        baseInlineStyles,
        wordOverrides: style.wordOverrides,
        splitWordsIntoLetters: style.rendering.splitWordsIntoLetters,
        includeVideoFrameLayer: style.rendering.videoFrame.required,
        extraWrapperStyles: {},
        decorationPlacements: style.decorationPlacements,
        inlineStyleEmitter: style.inlineStyleEmitter,
      },
      seg,
      seg.time.start,
      NO_EXCLUDED_WORDS,
    );
    return this.paintRegionResolver.resolve({
      segmentHtml,
      probeContainer: style.probeContainer,
      placement,
      viewportWidth: this.width,
      viewportHeight: this.height,
      safetyBleedEm: style.rendering.padding === null ? UNDECLARED_PADDING_SAFETY_EM : 0,
    });
  }

  private hasPositionedWord(seg: Segment, wordOverrides: ElementRenderOverrides): boolean {
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (wordOverrides.get(word.id)?.alignment) return true;
      }
    }
    return false;
  }

  private hasPositionedDecoration(seg: Segment, style: PreparedStyle): boolean {
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        if (style.wordOverrides.get(word.decoration.id)?.alignment) return true;
      }
    }
    return false;
  }
}
