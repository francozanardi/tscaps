import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import { Decoration } from '@modules/document/Decoration';
import { CssVariable } from '@modules/document/CssVariable';
import { Letter } from '@modules/document/Letter';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { InlineStyleEmitter } from '@modules/rendering/styles/InlineStyleEmitter';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { VIDEO_FRAME_LAYER_CLASS } from '@modules/rendering/styles/VideoFrameLayerClass';

const SEGMENT_DECORATIONS_ABOVE_CLASS = 'segment-decorations-above';
const SEGMENT_DECORATIONS_BELOW_CLASS = 'segment-decorations-below';

/**
 * Per-style inputs every build call needs. `inlineStyleEmitter`
 * encapsulates inline-style serialization so the builder stays free
 * of CSS-variable filtering and escaping concerns.
 */
export interface SegmentSubtreeStyleInput {
  readonly scopeClass: string;
  readonly baseInlineStyles: InlineStyleMap;
  readonly wordOverrides: ElementRenderOverrides;
  readonly splitWordsIntoLetters: boolean;
  readonly includeVideoFrameLayer: boolean;
  readonly extraWrapperStyles: InlineStyleMap;
  /** Decorations lifted out of line flow, keyed by decoration id. Absent ids render inline next to their host word. */
  readonly decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>;
  readonly inlineStyleEmitter: InlineStyleEmitter;
}

/**
 * Builds the `wrapper → segment → lines → words/letters` HTML
 * subtree for a segment at a given time, applying the segment's
 * classes, time-driven CSS variables, base typography styles, and
 * per-word overrides consistently. The output is the same HTML
 * shape every consumer embeds (an SVG `<foreignObject>`, a
 * measurement probe, etc.).
 *
 * Stateless — all per-style inputs arrive on every call through
 * {@link SegmentSubtreeStyleInput}.
 */
export class SegmentSubtreeHtmlBuilder {

  constructor(private readonly wordSplitter: WordSplitter) {}

  /**
   * Builds the wrapper + segment subtree containing every line and
   * word of the segment. Words whose ids appear in `excludedWordIds`
   * are skipped entirely — they are not rendered in the line, so
   * neighbours reflow into the freed slot.
   */
  buildSegmentSubtree(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    excludedWordIds: ReadonlySet<string>,
  ): string {
    const linesHtml = [...seg.lines]
      .map((line) => this.buildLineHtml(style, line, t, excludedWordIds))
      .join('');
    const aboveHtml = this.buildPromotedDecorationsContainerHtml(style, seg, t, 'above');
    const belowHtml = this.buildPromotedDecorationsContainerHtml(style, seg, t, 'below');
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + aboveHtml + linesHtml + belowHtml;
    return this.wrapInScope(style, seg, t, innerHtml);
  }

  /**
   * Builds the wrapper + segment subtree containing a single
   * line-and-word chain around `word`. Used for synthesizing the
   * minimum context a word needs when it has been promoted out of
   * the main flow by a per-word alignment override.
   */
  buildSingleWordSubtree(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    line: Line,
    word: Word,
    t: number,
  ): string {
    const wordHtml = this.buildWordHtml(style, word, t);
    const lineHtml = this.buildLineWrapperHtml(style, line, t, wordHtml);
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + lineHtml;
    return this.wrapInScope(style, seg, t, innerHtml);
  }

  /**
   * Builds the wrapper + segment subtree containing only the
   * decoration glyph attached to `word`. Used when a per-decoration
   * alignment override paints the glyph at its own anchor instead of
   * inline next to its host word.
   */
  buildSingleDecorationSubtree(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    line: Line,
    word: Word,
    t: number,
  ): string {
    const decorationHtml = this.buildDecorationSpanHtml(style, word.decoration, t);
    const lineHtml = this.buildLineWrapperHtml(style, line, t, decorationHtml);
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + lineHtml;
    return this.wrapInScope(style, seg, t, innerHtml);
  }

  private wrapInScope(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    innerHtml: string,
  ): string {
    const wrapperStyle = this.composeWrapperStyle(style);
    const segHtml = this.composeSegmentHtml(style, seg, t, innerHtml);
    return `<div class="${style.scopeClass}" style="${wrapperStyle}">${segHtml}</div>`;
  }

  private composeWrapperStyle(style: SegmentSubtreeStyleInput): string {
    const merged: InlineStyleMap = { ...style.baseInlineStyles, ...style.extraWrapperStyles };
    const inlineStyleString = style.inlineStyleEmitter.serializeStyles(merged);
    return `display: inline-block; width: max-content; min-width: 0; min-height: 0; ${inlineStyleString}`;
  }

  private composeSegmentHtml(style: SegmentSubtreeStyleInput, seg: Segment, t: number, innerHtml: string): string {
    const classes = seg.getCssClasses(t).join(' ');
    const segStyle = style.inlineStyleEmitter.serializeAnimatedVars(seg.getCssVariables(t));
    return `<div class="${classes}" style="${segStyle}">${innerHtml}</div>`;
  }

  private buildLineWrapperHtml(
    style: SegmentSubtreeStyleInput,
    line: Line,
    t: number,
    innerHtml: string,
  ): string {
    const classes = line.getCssClasses(t).join(' ');
    const lineStyle = style.inlineStyleEmitter.serializeAnimatedVars(line.getCssVariables(t));
    return `<div class="${classes}" style="${lineStyle}">${innerHtml}</div>`;
  }

  private buildLineHtml(
    style: SegmentSubtreeStyleInput,
    line: Line,
    t: number,
    excludedWordIds: ReadonlySet<string>,
  ): string {
    const visibleWords = [...line.words].filter((word) => !excludedWordIds.has(word.id));
    // A line with no remaining words is omitted entirely — emitting an
    // empty `<div class="line">` would still paint line-level
    // decorations (bubble backgrounds, tails, sibling-combinator gaps)
    // with no content to anchor them.
    if (visibleWords.length === 0) return '';
    const wordsHtml = visibleWords.map((word) => this.buildWordHtml(style, word, t)).join('');
    return this.buildLineWrapperHtml(style, line, t, wordsHtml);
  }

  // Lives inside `.segment` so the segment's own clipping and
  // stacking context apply to the layer the same way they apply
  // to any other child.
  private maybeVideoFrameLayerHtml(style: SegmentSubtreeStyleInput): string {
    return style.includeVideoFrameLayer
      ? `<div class="${VIDEO_FRAME_LAYER_CLASS}"></div>`
      : '';
  }

  private buildWordHtml(
    style: SegmentSubtreeStyleInput,
    word: Word,
    t: number,
  ): string {
    const wordClasses = word.getCssClasses(t);
    const wordVars = word.getCssVariables(t);
    const overrideStyle = style.inlineStyleEmitter.serializeStyles(style.wordOverrides.get(word.id)?.inlineStyles);
    const decorationHtml = this.shouldEmitInlineDecoration(style, word)
      ? this.buildDecorationSpanHtml(style, word.decoration, t)
      : '';
    const trailHtml = word.decoration ? this.escapeHtml(word.decoration.trail) : '';

    if (!style.splitWordsIntoLetters) {
      const wordStyle = style.inlineStyleEmitter.serializeAnimatedVars(wordVars) + overrideStyle;
      return `<span class="${wordClasses.join(' ')}" style="${wordStyle}">${this.escapeHtml(word.displayText)}${decorationHtml}${trailHtml}</span>`;
    }

    const letters = this.wordSplitter.split(word.displayText);
    const wordStyle = style.inlineStyleEmitter.serializeAnimatedVars(
      { ...wordVars, [CssVariable.LETTER_COUNT]: String(letters.length) },
    ) + overrideStyle;
    const lettersHtml = letters.map((letter, i) => {
      const letterStyle = style.inlineStyleEmitter.serializeAnimatedVars({ [CssVariable.LETTER_INDEX]: String(i) });
      return `<span class="${Letter.CSS_CLASS}" style="${letterStyle}">${this.escapeHtml(letter)}</span>`;
    }).join('');
    return `<span class="${wordClasses.join(' ')}" style="${wordStyle}">${lettersHtml}${decorationHtml}${trailHtml}</span>`;
  }

  private shouldEmitInlineDecoration(style: SegmentSubtreeStyleInput, word: Word): boolean {
    if (!word.decoration) return false;
    const decorationId = word.decoration.id;
    if (style.wordOverrides.get(decorationId)?.alignment) return false;
    if (style.decorationPlacements.has(decorationId)) return false;
    return true;
  }

  private buildPromotedDecorationsContainerHtml(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    side: DecorationPlacementSide,
  ): string {
    if (style.decorationPlacements.size === 0) return '';
    const decorationsHtml = this.collectPromotedDecorationsHtml(style, seg, t, side);
    if (!decorationsHtml) return '';
    const containerClass = side === 'above' ? SEGMENT_DECORATIONS_ABOVE_CLASS : SEGMENT_DECORATIONS_BELOW_CLASS;
    return `<div class="${containerClass}">${decorationsHtml}</div>`;
  }

  private collectPromotedDecorationsHtml(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    side: DecorationPlacementSide,
  ): string {
    let html = '';
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        const decorationId = word.decoration.id;
        if (style.decorationPlacements.get(decorationId) !== side) continue;
        // A manual alignment override takes the decoration out of the
        // segment subtree entirely — the caller paints it at its own
        // anchor, so the segment-side container must skip it too.
        if (style.wordOverrides.get(decorationId)?.alignment) continue;
        html += this.buildDecorationSpanHtml(style, word.decoration, t);
      }
    }
    return html;
  }

  private buildDecorationSpanHtml(style: SegmentSubtreeStyleInput, decoration: Decoration | null, t: number): string {
    if (!decoration) return '';
    const overrideStyle = style.inlineStyleEmitter.serializeStyles(style.wordOverrides.get(decoration.id)?.inlineStyles);
    const animatedVars = style.inlineStyleEmitter.serializeAnimatedVars(decoration.getCssVariables(t));
    return `<span class="${Decoration.CSS_CLASS}" style="${animatedVars}${overrideStyle}">${this.escapeHtml(decoration.glyph)}</span>`;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
