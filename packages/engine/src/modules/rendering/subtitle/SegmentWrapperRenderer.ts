import type { Segment } from '@modules/document/Segment';
import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { TextDirection } from '@modules/bidi/TextDirection';
import type { HorizontalPlacementResolver } from '@modules/rendering/HorizontalPlacementResolver';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { SegmentSubtreeHtmlBuilder, SegmentSubtreeStyleInput } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import type { VideoFrameVarsBuilder } from '@modules/rendering/subtitle/VideoFrameVarsBuilder';
import type { SegmentAnchorVarsBuilder } from '@modules/rendering/subtitle/SegmentAnchorVarsBuilder';
import type { ElementWidthMeasurer } from '@modules/rendering/subtitle/ElementWidthMeasurer';
import { ElementWidths } from '@modules/rendering/subtitle/ElementWidths';
import type { SvgFilterMaterializer } from '@modules/rendering/subtitle/SvgFilterMaterializer';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type {
  PositionedSubtreeDecoration,
  PositionedSubtreeWord,
  SegmentSubtreeDecomposer,
  SegmentSubtreeDecomposition,
} from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { SubtreeIsolationMarks } from '@modules/rendering/subtitle/SubtreeIsolationMarks';
import type { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import { profiler } from '@modules/profiling/Profiler';

export interface WrapperRender {
  html: string;
  defs: string;
}

interface ResolvedAlignment {
  /** The unrounded fraction behind `yPx`, for consumers that need frame-relative terms. */
  verticalOffset: number;
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
 *
 * Isolation: an element still in the main subtree
 * that paints in another layer is painted by a copy of it, at the same
 * anchor with the same classes, variables and measured widths — so it
 * lays out exactly as the original.
 *
 * Emits only the subtrees that paint in its `layer`, so one tile holds
 * one caption layer and the compositor stacks them.
 */
export class SegmentWrapperRenderer {

  constructor(
    private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder,
    private readonly subtreeDecomposer: SegmentSubtreeDecomposer,
    private readonly filterMaterializer: SvgFilterMaterializer,
    private readonly videoFrameVarsBuilder: VideoFrameVarsBuilder,
    private readonly segmentAnchorVarsBuilder: SegmentAnchorVarsBuilder,
    private readonly elementWidthMeasurer: ElementWidthMeasurer,
    private readonly horizontalPlacementResolver: HorizontalPlacementResolver,
    private readonly width: number,
    private readonly height: number,
    private readonly layer: CaptionLayer,
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

    const segmentInlineStyles: InlineStyleMap = segmentOverride?.inlineStyles ?? {};
    const segmentClasses = segmentOverride?.classes ?? [];

    const decomposition = this.subtreeDecomposer.decompose(
      seg, style.subtreeOverrides, style.decorationPlacements, segmentOverride,
    );

    // Skip the main segment subtree entirely when every word has been
    // pulled into a positioned-word sibling — otherwise the segment's
    // own decorations (background, ::before chrome, padding) would
    // paint as an empty shell. Positioned words render below regardless.
    let html = '';
    let defs = '';
    if (!decomposition.everyWordIsPositioned) {
      const main = await this.buildSegmentSubtreeHtml(
        style, seg, t, indexInSection, segmentAlignment, segmentInlineStyles, segmentClasses, decomposition, nextUid,
      );
      html = main.html;
      defs = main.defs;
    }
    for (const positioned of decomposition.positionedWords) {
      if (this.subtreeDecomposer.elementLayerOf(positioned.word.id, style.subtreeOverrides, decomposition.segmentLayer) !== this.layer) continue;
      const wordAlignmentOverride = style.subtreeOverrides.get(positioned.word.id)?.alignment;
      const wordAlignment: AlignmentConfig = { ...segmentAlignment, ...wordAlignmentOverride };
      const built = await this.buildPositionedWordSubtreeHtml(
        style, seg, positioned, t, indexInSection, wordAlignment, segmentInlineStyles, nextUid,
      );
      html += built.html;
      defs += built.defs;
    }
    for (const positioned of decomposition.positionedDecorations) {
      if (this.subtreeDecomposer.elementLayerOf(positioned.decoration.id, style.subtreeOverrides, decomposition.segmentLayer) !== this.layer) continue;
      const decorationAlignmentOverride = style.subtreeOverrides.get(positioned.decoration.id)?.alignment;
      const decorationAlignment: AlignmentConfig = { ...segmentAlignment, ...decorationAlignmentOverride };
      const built = await this.buildPositionedDecorationSubtreeHtml(
        style, seg, positioned, t, indexInSection, decorationAlignment, segmentInlineStyles, nextUid,
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
    segmentInlineStyles: InlineStyleMap,
    segmentClasses: ReadonlyArray<string>,
    decomposition: SegmentSubtreeDecomposition,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment, style.rendering.textDirection);
    const engineVars = await this.buildEngineVars(style, seg, resolved, t);
    const { defs, bindings } = profiler.time('SegmentWrapperRenderer.filterDefs', () =>
      this.filterMaterializer.materialize(style, t, engineVars, nextUid),
    );

    const unmeasured = this.composeStyleInput(
      style,
      this.mergeExtras(engineVars, bindings, style.inlineStyles),
      segmentInlineStyles,
      segmentClasses,
      SubtreeIsolationMarks.hiding(decomposition.isolatedIds),
    );
    const styleInput = {
      ...unmeasured,
      elementWidths: this.elementWidthMeasurer.widthsFor(style, unmeasured, seg, t, indexInSection),
    };
    const anchorStyle = this.composeAnchorStyle(resolved);
    let html = '';
    if (decomposition.segmentLayer === this.layer) {
      const subtreeHtml = profiler.time('SegmentWrapperRenderer.subtreeHtml', () =>
        this.subtreeBuilder.buildSegmentSubtree(styleInput, seg, t, decomposition.excludedWordIds, indexInSection),
      );
      html = `<div style="${anchorStyle}">${subtreeHtml}</div>`;
    }
    // A copy carries no frame layer and so none of the frame's variables:
    // the layer belongs to the original, and the frame is the heaviest
    // thing a tile carries.
    const copyExtras = this.mergeExtras(this.segmentAnchorVarsBuilder.build(resolved), bindings, style.inlineStyles);
    for (const group of decomposition.isolatedGroups) {
      if (group.layer !== this.layer) continue;
      const copyInput: SegmentSubtreeStyleInput = {
        ...styleInput,
        includeVideoFrameLayer: false,
        extraWrapperStyles: copyExtras,
        isolationMarks: SubtreeIsolationMarks.keeping(group.keptIds, decomposition.isolatedIds),
      };
      const copyHtml = profiler.time('SegmentWrapperRenderer.isolatedCopyHtml', () =>
        this.subtreeBuilder.buildSegmentSubtree(copyInput, seg, t, decomposition.excludedWordIds, indexInSection),
      );
      html += `<div style="${anchorStyle}">${copyHtml}</div>`;
    }
    return { html, defs };
  }

  private async buildPositionedWordSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    positioned: PositionedSubtreeWord,
    t: number,
    indexInSection: number,
    alignment: AlignmentConfig,
    segmentInlineStyles: InlineStyleMap,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment, style.rendering.textDirection);
    const engineVars = await this.buildEngineVars(style, seg, resolved, t);
    const { defs, bindings } = profiler.time('SegmentWrapperRenderer.filterDefs', () =>
      this.filterMaterializer.materialize(style, t, engineVars, nextUid),
    );

    const styleInput = this.composeStyleInput(
      style,
      this.mergeExtras(engineVars, bindings, style.inlineStyles),
      segmentInlineStyles,
    );
    const subtreeHtml = profiler.time('SegmentWrapperRenderer.subtreeHtml', () =>
      this.subtreeBuilder.buildSingleWordSubtree(
        styleInput, seg, positioned.line, positioned.word, t, indexInSection, positioned.indexInLine,
      ),
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
    segmentInlineStyles: InlineStyleMap,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment, style.rendering.textDirection);
    const engineVars = await this.buildEngineVars(style, seg, resolved, t);
    const { defs, bindings } = profiler.time('SegmentWrapperRenderer.filterDefs', () =>
      this.filterMaterializer.materialize(style, t, engineVars, nextUid),
    );

    const styleInput = this.composeStyleInput(
      style,
      this.mergeExtras(engineVars, bindings, style.inlineStyles),
      segmentInlineStyles,
    );
    const subtreeHtml = profiler.time('SegmentWrapperRenderer.subtreeHtml', () =>
      this.subtreeBuilder.buildSingleDecorationSubtree(
        styleInput, seg, positioned.line, positioned.word, t, indexInSection,
      ),
    );
    const anchorStyle = this.composeAnchorStyle(resolved);

    return { html: `<div style="${anchorStyle}">${subtreeHtml}</div>`, defs };
  }

  /** Every variable the engine publishes onto one subtree's wrapper. */
  private async buildEngineVars(
    style: PreparedStyle,
    seg: Segment,
    resolved: ResolvedAlignment,
    t: number,
  ): Promise<InlineStyleMap> {
    return {
      ...(await this.videoFrameVarsBuilder.build(style, seg, resolved, t)),
      ...this.segmentAnchorVarsBuilder.build(resolved),
    };
  }

  // Zero-sized grid anchor places the wrapper via `place-items`
  // so the wrapper stays transform-free and doesn't form a
  // stacking context (which would trap descendant
  // `mix-blend-mode` away from the layer).
  private composeAnchorStyle(resolved: ResolvedAlignment): string {
    return `position: absolute; top: ${resolved.yPx}px; left: ${resolved.xPx}px; width: 0; height: 0; display: grid; grid-template: 0 / 0; align-items: ${resolved.vGridAlign}; justify-items: ${resolved.hGridAlign};`;
  }

  // Positioned sibling subtrees never receive segment classes: they pin
  // an element at its own explicit anchor, and a style rule reacting to
  // segment state (e.g. a lift) would displace it from that spot.
  private composeStyleInput(
    style: PreparedStyle,
    extraWrapperStyles: InlineStyleMap,
    segmentInlineStyles: InlineStyleMap,
    extraSegmentClasses: ReadonlyArray<string> = [],
    isolationMarks: SubtreeIsolationMarks = SubtreeIsolationMarks.none(),
  ): SegmentSubtreeStyleInput {
    return {
      scopeClass: style.scopeClass,
      baseInlineStyles: style.inlineStyles,
      segmentInlineStyles,
      subtreeOverrides: style.subtreeOverrides,
      splitWordsIntoLetters: style.rendering.splitWordsIntoLetters,
      includeVideoFrameLayer: style.rendering.videoFrame.required,
      textDirection: style.rendering.textDirection,
      extraWrapperStyles,
      extraSegmentClasses,
      decorationPlacements: style.decorationPlacements,
      addressableElementIds: style.addressableElementIds,
      elementWidths: ElementWidths.empty(),
      inlineStyleEmitter: style.inlineStyleEmitter,
      isolationMarks,
    };
  }

  private mergeExtras(
    engineVars: InlineStyleMap,
    bindings: ReadonlyMap<string, string>,
    baseInlineStyles: InlineStyleMap,
  ): InlineStyleMap {
    return { ...baseInlineStyles, ...engineVars, ...Object.fromEntries(bindings) };
  }

  private resolveAlignment(alignment: AlignmentConfig, textDirection: TextDirection): ResolvedAlignment {
    const horizontal = this.horizontalPlacementResolver.resolve(
      alignment.horizontalAlign,
      alignment.horizontalOffset,
      textDirection,
    );
    return {
      verticalOffset: alignment.verticalOffset,
      yPx: Math.round(alignment.verticalOffset * this.height),
      xPx: Math.round(horizontal.offsetFromLeft * this.width),
      vAnchorPct: alignment.verticalAlign === 'top' ? 0 : alignment.verticalAlign === 'center' ? 50 : 100,
      hAnchorPct: horizontal.side === 'left' ? 0 : horizontal.side === 'center' ? 50 : 100,
      vGridAlign: alignment.verticalAlign === 'top' ? 'start' : alignment.verticalAlign === 'center' ? 'center' : 'end',
      hGridAlign: horizontal.side === 'left' ? 'start' : horizontal.side === 'center' ? 'center' : 'end',
    };
  }
}
