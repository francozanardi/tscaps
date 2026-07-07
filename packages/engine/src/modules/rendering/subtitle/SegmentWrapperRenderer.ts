import type { Segment } from '@modules/document/Segment';
import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { SegmentSubtreeHtmlBuilder, SegmentSubtreeStyleInput } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import type { VideoFrameVarsBuilder } from '@modules/rendering/subtitle/VideoFrameVarsBuilder';
import type { SvgFilterMaterializer } from '@modules/rendering/subtitle/SvgFilterMaterializer';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type {
  PositionedSubtreeDecoration,
  PositionedSubtreeWord,
  SegmentSubtreeDecomposer,
} from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';

export interface WrapperRender {
  html: string;
  defs: string;
}

interface ResolvedAlignment {
  yPx: number;
  xPx: number;
  vAnchorPct: number;
  hAnchorPct: number;
  vGridAlign: 'start' | 'center' | 'end';
  hGridAlign: 'start' | 'center' | 'end';
}

/**
 * Builds the HTML wrapper for one render tile. Handles three subtree
 * shapes: the main segment subtree, a sibling subtree for a per-word
 * alignment override that pulls the word out of line flow, and a
 * sibling subtree for a decoration-only override that pins the glyph
 * at its own anchor. Each subtree carries its own anchor; the
 * positioned siblings appear after the main wrapper, with their
 * original slot in the line omitted so neighbours reflow. Aggregates
 * the SVG `<filter>` defs each subtree needs into the tile's `defs`.
 */
export class SegmentWrapperRenderer {

  constructor(
    private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder,
    private readonly subtreeDecomposer: SegmentSubtreeDecomposer,
    private readonly filterMaterializer: SvgFilterMaterializer,
    private readonly videoFrameVarsBuilder: VideoFrameVarsBuilder,
    private readonly width: number,
    private readonly height: number,
  ) {}

  async buildWrapperHtml(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    indexInSection: number,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const segmentOverride = style.segmentOverrides.get(seg.id);
    const segmentAlignment: AlignmentConfig = { ...style.alignment, ...segmentOverride?.alignment };

    const segmentInlineStylesOverride = segmentOverride?.inlineStyles;
    const baseInlineStyles: InlineStyleMap = segmentInlineStylesOverride
      ? { ...style.inlineStyles, ...segmentInlineStylesOverride }
      : style.inlineStyles;

    const decomposition = this.subtreeDecomposer.decompose(seg, style.wordOverrides);

    // Skip the main segment subtree entirely when every word has been
    // pulled into a positioned-word sibling — otherwise the segment's
    // own decorations (background, ::before chrome, padding) would
    // paint as an empty shell. Positioned words render below regardless.
    let html = '';
    let defs = '';
    if (!decomposition.everyWordIsPositioned) {
      const main = await this.buildSegmentSubtreeHtml(
        style, seg, t, indexInSection, segmentAlignment, baseInlineStyles, decomposition.excludedWordIds, nextUid,
      );
      html = main.html;
      defs = main.defs;
    }
    for (const positioned of decomposition.positionedWords) {
      const wordAlignmentOverride = style.wordOverrides.get(positioned.word.id)?.alignment;
      const wordAlignment: AlignmentConfig = { ...segmentAlignment, ...wordAlignmentOverride };
      const built = await this.buildPositionedWordSubtreeHtml(
        style, seg, positioned, t, indexInSection, wordAlignment, baseInlineStyles, nextUid,
      );
      html += built.html;
      defs += built.defs;
    }
    for (const positioned of decomposition.positionedDecorations) {
      const decorationAlignmentOverride = style.wordOverrides.get(positioned.decoration.id)?.alignment;
      const decorationAlignment: AlignmentConfig = { ...segmentAlignment, ...decorationAlignmentOverride };
      const built = await this.buildPositionedDecorationSubtreeHtml(
        style, seg, positioned, t, indexInSection, decorationAlignment, baseInlineStyles, nextUid,
      );
      html += built.html;
      defs += built.defs;
    }
    return { html, defs };
  }

  private async buildSegmentSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    indexInSection: number,
    alignment: AlignmentConfig,
    baseInlineStyles: InlineStyleMap,
    excludedWordIds: ReadonlySet<string>,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment);
    const engineVars = await this.videoFrameVarsBuilder.build(style, seg, resolved, t);
    const { defs, bindings } = this.filterMaterializer.materialize(style, t, engineVars, nextUid);

    const styleInput = this.composeStyleInput(style, this.mergeExtras(engineVars, bindings, baseInlineStyles));
    const subtreeHtml = this.subtreeBuilder.buildSegmentSubtree(styleInput, seg, t, excludedWordIds, indexInSection);
    const anchorStyle = this.composeAnchorStyle(resolved);

    return { html: `<div style="${anchorStyle}">${subtreeHtml}</div>`, defs };
  }

  private async buildPositionedWordSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    positioned: PositionedSubtreeWord,
    t: number,
    indexInSection: number,
    alignment: AlignmentConfig,
    baseInlineStyles: InlineStyleMap,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment);
    const engineVars = await this.videoFrameVarsBuilder.build(style, seg, resolved, t);
    const { defs, bindings } = this.filterMaterializer.materialize(style, t, engineVars, nextUid);

    const styleInput = this.composeStyleInput(style, this.mergeExtras(engineVars, bindings, baseInlineStyles));
    const subtreeHtml = this.subtreeBuilder.buildSingleWordSubtree(
      styleInput, seg, positioned.line, positioned.word, t, indexInSection, positioned.indexInLine,
    );
    const anchorStyle = this.composeAnchorStyle(resolved);

    return { html: `<div style="${anchorStyle}">${subtreeHtml}</div>`, defs };
  }

  private async buildPositionedDecorationSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    positioned: PositionedSubtreeDecoration,
    t: number,
    indexInSection: number,
    alignment: AlignmentConfig,
    baseInlineStyles: InlineStyleMap,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment);
    const engineVars = await this.videoFrameVarsBuilder.build(style, seg, resolved, t);
    const { defs, bindings } = this.filterMaterializer.materialize(style, t, engineVars, nextUid);

    const styleInput = this.composeStyleInput(style, this.mergeExtras(engineVars, bindings, baseInlineStyles));
    const subtreeHtml = this.subtreeBuilder.buildSingleDecorationSubtree(
      styleInput, seg, positioned.line, positioned.word, t, indexInSection,
    );
    const anchorStyle = this.composeAnchorStyle(resolved);

    return { html: `<div style="${anchorStyle}">${subtreeHtml}</div>`, defs };
  }

  // Zero-sized grid anchor places the wrapper via `place-items`
  // so the wrapper stays transform-free and doesn't form a
  // stacking context (which would trap descendant
  // `mix-blend-mode` away from the layer).
  private composeAnchorStyle(resolved: ResolvedAlignment): string {
    return `position: absolute; top: ${resolved.yPx}px; left: ${resolved.xPx}px; width: 0; height: 0; display: grid; grid-template: 0 / 0; align-items: ${resolved.vGridAlign}; justify-items: ${resolved.hGridAlign};`;
  }

  private composeStyleInput(style: PreparedStyle, extraWrapperStyles: InlineStyleMap): SegmentSubtreeStyleInput {
    return {
      scopeClass: style.scopeClass,
      baseInlineStyles: style.inlineStyles,
      wordOverrides: style.wordOverrides,
      splitWordsIntoLetters: style.rendering.splitWordsIntoLetters,
      includeVideoFrameLayer: style.rendering.videoFrame.required,
      extraWrapperStyles,
      decorationPlacements: style.decorationPlacements,
      inlineStyleEmitter: style.inlineStyleEmitter,
    };
  }

  private mergeExtras(
    engineVars: InlineStyleMap,
    bindings: ReadonlyMap<string, string>,
    baseInlineStyles: InlineStyleMap,
  ): InlineStyleMap {
    return { ...baseInlineStyles, ...engineVars, ...Object.fromEntries(bindings) };
  }

  private resolveAlignment(alignment: AlignmentConfig): ResolvedAlignment {
    return {
      yPx: Math.round(alignment.verticalOffset * this.height),
      xPx: Math.round(alignment.horizontalOffset * this.width),
      vAnchorPct: alignment.verticalAlign === 'top' ? 0 : alignment.verticalAlign === 'center' ? 50 : 100,
      hAnchorPct: alignment.horizontalAlign === 'left' ? 0 : alignment.horizontalAlign === 'center' ? 50 : 100,
      vGridAlign: alignment.verticalAlign === 'top' ? 'start' : alignment.verticalAlign === 'center' ? 'center' : 'end',
      hGridAlign: alignment.horizontalAlign === 'left' ? 'start' : alignment.horizontalAlign === 'center' ? 'center' : 'end',
    };
  }
}
