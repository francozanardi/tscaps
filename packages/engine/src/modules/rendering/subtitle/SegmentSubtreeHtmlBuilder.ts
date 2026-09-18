import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import { Decoration } from '@modules/document/Decoration';
import { ElementWidths } from '@modules/rendering/subtitle/ElementWidths';
import { CssVariable } from '@modules/document/CssVariable';
import { Letter } from '@modules/document/Letter';
import { TimeFragment } from '@modules/document/TimeFragment';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { InlineStyleEmitter } from '@modules/rendering/styles/InlineStyleEmitter';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { CssClass } from '@modules/document/CssClass';
import { DataAttribute } from '@modules/document/DataAttribute';
import type { TextDirection } from '@modules/bidi/TextDirection';
import type { WordFragment } from '@modules/bidi/WordFragment';
import type { WordFragmenter } from '@modules/bidi/WordFragmenter';

// Words are emitted already ordered as they paint, so the line must lay its
// children out left to right no matter what direction it would inherit —
// an inherited `rtl` would reverse an order that is already final.
const LINE_LAYOUT_STYLE = 'direction: ltr; ';

/**
 * Per-style inputs every build call needs. `inlineStyleEmitter`
 * encapsulates inline-style serialization so the builder stays free
 * of CSS-variable filtering and escaping concerns.
 */
export interface SegmentSubtreeStyleInput {
  readonly scopeClass: string;
  readonly baseInlineStyles: InlineStyleMap;
  readonly segmentInlineStyles: InlineStyleMap;
  /**
   * Overrides for the elements inside the segment, by element id: its
   * lines, its words, and the glyphs attached to them. Each one's inline
   * styles land on that element's own `style` attribute.
   */
  readonly subtreeOverrides: ElementRenderOverrides;
  readonly splitWordsIntoLetters: boolean;
  readonly includeVideoFrameLayer: boolean;
  readonly extraWrapperStyles: InlineStyleMap;
  /** Classes appended to the `.segment` element's class list, after the structural ones. */
  readonly extraSegmentClasses: ReadonlyArray<string>;
  /** Decorations lifted out of line flow, keyed by decoration id. Absent ids render inline next to their host word. */
  readonly decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>;
  readonly inlineStyleEmitter: InlineStyleEmitter;
  /** Paragraph direction every line is resolved against. */
  readonly textDirection: TextDirection;
  /**
   * Ids of elements the stylesheet addresses individually. Each such
   * element is stamped with {@link DataAttribute.ELEMENT_ID}; the rest
   * carry no id, because the markup is serialized once per frame and
   * stamping everything grows it by roughly a quarter.
   */
  readonly addressableElementIds: ReadonlySet<string>;
  /** Measured widths of this segment's elements; empty when nothing reads them. */
  readonly elementWidths: ElementWidths;
}

/** A word that survived exclusion, paired with the position it holds in its line. */
interface VisibleWord {
  readonly word: Word;
  readonly indexInLine: number;
}

/** Everything one painted fragment of a word needs to become a `<span>`. */
interface WordFragmentRenderInput {
  readonly fragment: WordFragment;
  readonly word: Word;
  readonly indexInLine: number;
  /** Inline declarations that close the inter-word gap against a neighbour it reads continuously with. */
  readonly gapStyle: string;
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

  constructor(
    private readonly wordSplitter: WordSplitter,
    private readonly wordFragmenter: WordFragmenter,
  ) {}

  /**
   * Builds the wrapper + segment subtree containing every line and
   * word of the segment. Words whose ids appear in `excludedWordIds`
   * are skipped entirely — they are not rendered in the line, so
   * neighbours reflow into the freed slot.
   *
   * `indexInSection` is the segment's zero-based position inside its
   * owning section; published as `--segment-index` on the segment node.
   */
  buildSegmentSubtree(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    excludedWordIds: ReadonlySet<string>,
    indexInSection: number,
  ): string {
    const segTime = seg.time;
    const linesHtml = [...seg.lines]
      .map((line) => this.buildLineHtml(style, line, t, excludedWordIds, segTime))
      .join('');
    const aboveHtml = this.buildPromotedDecorationsContainerHtml(style, seg, t, 'above', segTime);
    const belowHtml = this.buildPromotedDecorationsContainerHtml(style, seg, t, 'below', segTime);
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + aboveHtml + linesHtml + belowHtml;
    return this.wrapInScope(style, seg, t, indexInSection, innerHtml);
  }

  /**
   * Builds the wrapper + segment subtree containing a single
   * line-and-word chain around `word`. Used for synthesizing the
   * minimum context a word needs when it has been promoted out of
   * the main flow by a per-word alignment override.
   *
   * `indexInSection` / `indexInLine` keep the published timing /
   * structural variables (`--segment-index`, `--word-index`) consistent
   * with the original tree position.
   */
  buildSingleWordSubtree(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    line: Line,
    word: Word,
    t: number,
    indexInSection: number,
    indexInLine: number,
  ): string {
    const segTime = seg.time;
    const wordHtml = this.buildWordsHtml(style, [{ word, indexInLine }], t, segTime);
    const lineHtml = this.buildLineWrapperHtml(style, line, t, segTime, wordHtml);
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + lineHtml;
    return this.wrapInScope(style, seg, t, indexInSection, innerHtml);
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
    indexInSection: number,
  ): string {
    const segTime = seg.time;
    const decorationHtml = this.buildDecorationSpanHtml(style, word.decoration, t, segTime, word.time);
    const lineHtml = this.buildLineWrapperHtml(style, line, t, segTime, decorationHtml);
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + lineHtml;
    return this.wrapInScope(style, seg, t, indexInSection, innerHtml);
  }

  private wrapInScope(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    indexInSection: number,
    innerHtml: string,
  ): string {
    const wrapperStyle = this.composeWrapperStyle(style);
    const segHtml = this.composeSegmentHtml(style, seg, t, indexInSection, innerHtml);
    return `<div class="${style.scopeClass}" style="${wrapperStyle}">${segHtml}</div>`;
  }

  private composeWrapperStyle(style: SegmentSubtreeStyleInput): string {
    const merged: InlineStyleMap = { ...style.baseInlineStyles, ...style.extraWrapperStyles };
    const inlineStyleString = style.inlineStyleEmitter.serializeStyles(merged);
    return `display: inline-block; width: max-content; min-width: 0; min-height: 0; ${inlineStyleString}`;
  }

  // The extra classes ride the segment element, not the scope wrapper:
  // scoped stylesheets prefix every selector with the scope class as an
  // ancestor, so a class sharing the wrapper node would be unreachable
  // from them.
  private composeSegmentHtml(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    indexInSection: number,
    innerHtml: string,
  ): string {
    const classes = [...seg.getCssClasses(t), ...style.extraSegmentClasses].join(' ');
    const segStyle = style.inlineStyleEmitter.serializeStyles({
      ...seg.getCssVariables(t, { indexInSection }),
      ...style.elementWidths.varsFor(CssVariable.SEGMENT_WIDTH_EM, seg.id),
      ...style.segmentInlineStyles,
    });
    return `<div class="${classes}" style="${segStyle}"${this.elementIdAttr(style, seg.id)}>${innerHtml}</div>`;
  }

  private buildLineWrapperHtml(
    style: SegmentSubtreeStyleInput,
    line: Line,
    t: number,
    segTime: TimeFragment,
    innerHtml: string,
  ): string {
    const classes = line.getCssClasses(t).join(' ');
    const lineStyle = LINE_LAYOUT_STYLE
      + style.inlineStyleEmitter.serializeStyles({
        ...line.getCssVariables(t, { segTime }),
        ...style.elementWidths.varsFor(CssVariable.LINE_WIDTH_EM, line.id),
        ...style.subtreeOverrides.get(line.id)?.inlineStyles,
      });
    return `<div class="${classes}" style="${lineStyle}"${this.elementIdAttr(style, line.id)}>${innerHtml}</div>`;
  }

  private buildLineHtml(
    style: SegmentSubtreeStyleInput,
    line: Line,
    t: number,
    excludedWordIds: ReadonlySet<string>,
    segTime: TimeFragment,
  ): string {
    const visibleWords: VisibleWord[] = [];
    for (let i = 0; i < line.words.length; i++) {
      const word = line.words[i]!;
      if (excludedWordIds.has(word.id)) continue;
      visibleWords.push({ word, indexInLine: i });
    }
    // A line with no remaining words is omitted entirely — emitting an
    // empty `<div class="line">` would still paint line-level
    // decorations (bubble backgrounds, tails, sibling-combinator gaps)
    // with no content to anchor them.
    if (visibleWords.length === 0) return '';
    const wordsHtml = this.buildWordsHtml(style, visibleWords, t, segTime);
    return this.buildLineWrapperHtml(style, line, t, segTime, wordsHtml);
  }

  /**
   * Emits the words of one line as `<span>`s already ordered the way they
   * paint. The words are fragmented together rather than one at a time,
   * because the direction the algorithm resolves for a word depends on
   * the words beside it.
   */
  private buildWordsHtml(
    style: SegmentSubtreeStyleInput,
    visibleWords: ReadonlyArray<VisibleWord>,
    t: number,
    segTime: TimeFragment,
  ): string {
    const fragments = this.wordFragmenter.fragment(
      visibleWords.map(({ word }) => word.displayText),
      style.textDirection,
    );
    return fragments
      .map((fragment, index) => this.buildWordFragmentHtml(style, {
        fragment,
        word: visibleWords[fragment.wordIndex]!.word,
        indexInLine: visibleWords[fragment.wordIndex]!.indexInLine,
        gapStyle: this.buildGapStyle(fragments, index),
      }, t, segTime))
      .join('');
  }

  // Two fragments that read as one uninterrupted stretch must not be pushed
  // apart by the per-word margin templates set for the spaces between words.
  private buildGapStyle(fragments: ReadonlyArray<WordFragment>, index: number): string {
    let style = '';
    if (fragments[index]!.joinedToPrevious) style += 'margin-left: 0; ';
    if (fragments[index + 1]?.joinedToPrevious) style += 'margin-right: 0; ';
    return style;
  }

  // Lives inside `.segment` so the segment's own clipping and
  // stacking context apply to the layer the same way they apply
  // to any other child.
  private maybeVideoFrameLayerHtml(style: SegmentSubtreeStyleInput): string {
    return style.includeVideoFrameLayer
      ? `<div class="${CssClass.VIDEO_FRAME_LAYER}"></div>`
      : '';
  }

  private buildWordFragmentHtml(
    style: SegmentSubtreeStyleInput,
    input: WordFragmentRenderInput,
    t: number,
    segTime: TimeFragment,
  ): string {
    const { fragment, word, indexInLine } = input;
    const wordClasses = word.getCssClasses(t);
    const wordVars = {
      ...word.getCssVariables(t, { segTime, indexInLine }),
      ...style.elementWidths.varsFor(CssVariable.WORD_WIDTH_EM, word.id),
    };
    const overrideStyle = style.inlineStyleEmitter.serializeStyles(style.subtreeOverrides.get(word.id)?.inlineStyles);
    const decorationHtml = fragment.carriesWordTail && this.shouldEmitInlineDecoration(style, word)
      ? this.buildDecorationSpanHtml(style, word.decoration, t, segTime, word.time)
      : '';
    const trailHtml = fragment.carriesWordTail && word.decoration ? this.escapeHtml(word.decoration.trail) : '';
    const fragmentStyle = this.buildDirectionStyle(fragment) + input.gapStyle;
    // Every painted fragment of a word carries the word's id: a word split
    // across two embedding levels is two elements and one word, and a rule
    // addressing it means all of it.
    const wordIdAttr = this.elementIdAttr(style, word.id);

    // Letters of a joining script take their shape from their neighbours, so
    // painting them one box at a time would leave the word disconnected.
    if (!style.splitWordsIntoLetters || fragment.charactersJoin) {
      const wordStyle = style.inlineStyleEmitter.serializeStyles(wordVars) + overrideStyle + fragmentStyle;
      return `<span class="${wordClasses.join(' ')}" style="${wordStyle}"${wordIdAttr}>${this.escapeHtml(fragment.text)}${decorationHtml}${trailHtml}</span>`;
    }

    const letters = this.wordSplitter.split(fragment.text);
    const wordStyle = style.inlineStyleEmitter.serializeStyles(
      { ...wordVars, [CssVariable.LETTER_COUNT]: String(letters.length) },
    ) + overrideStyle + fragmentStyle;
    const lettersHtml = letters.map((letter, i) => {
      const letterStyle = style.inlineStyleEmitter.serializeStyles({ [CssVariable.LETTER_INDEX]: String(i) });
      return `<span class="${Letter.CSS_CLASS}" style="${letterStyle}">${this.escapeHtml(letter)}</span>`;
    }).join('');
    return `<span class="${wordClasses.join(' ')}" style="${wordStyle}"${wordIdAttr}>${lettersHtml}${decorationHtml}${trailHtml}</span>`;
  }

  // Only a fragment reading against the line's left-to-right flow has to say
  // so; the rest inherit it, and spelling it out would add bytes to every
  // word of every frame.
  private buildDirectionStyle(fragment: WordFragment): string {
    return fragment.direction === 'rtl' ? 'direction: rtl; ' : '';
  }

  private shouldEmitInlineDecoration(style: SegmentSubtreeStyleInput, word: Word): boolean {
    if (!word.decoration) return false;
    const decorationId = word.decoration.id;
    if (style.subtreeOverrides.get(decorationId)?.alignment) return false;
    if (style.decorationPlacements.has(decorationId)) return false;
    return true;
  }

  private buildPromotedDecorationsContainerHtml(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    side: DecorationPlacementSide,
    segTime: TimeFragment,
  ): string {
    if (style.decorationPlacements.size === 0) return '';
    const decorationsHtml = this.collectPromotedDecorationsHtml(style, seg, t, side, segTime);
    if (!decorationsHtml) return '';
    const containerClass = side === 'above' ? CssClass.SEGMENT_DECORATIONS_ABOVE : CssClass.SEGMENT_DECORATIONS_BELOW;
    return `<div class="${containerClass}">${decorationsHtml}</div>`;
  }

  private collectPromotedDecorationsHtml(
    style: SegmentSubtreeStyleInput,
    seg: Segment,
    t: number,
    side: DecorationPlacementSide,
    segTime: TimeFragment,
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
        if (style.subtreeOverrides.get(decorationId)?.alignment) continue;
        html += this.buildDecorationSpanHtml(style, word.decoration, t, segTime, word.time);
      }
    }
    return html;
  }

  private buildDecorationSpanHtml(
    style: SegmentSubtreeStyleInput,
    decoration: Decoration | null,
    t: number,
    segTime: TimeFragment,
    wordTime: TimeFragment,
  ): string {
    if (!decoration) return '';
    const overrideStyle = style.inlineStyleEmitter.serializeStyles(style.subtreeOverrides.get(decoration.id)?.inlineStyles);
    const animatedVars = style.inlineStyleEmitter.serializeStyles(decoration.getCssVariables(t, { segTime, wordTime }));
    return `<span class="${Decoration.CSS_CLASS}" style="${animatedVars}${overrideStyle}"${this.elementIdAttr(style, decoration.id)}>${this.escapeHtml(decoration.glyph)}</span>`;
  }

  /**
   * The id attribute for an element the stylesheet addresses, or an
   * empty string for one it does not.
   */
  private elementIdAttr(style: SegmentSubtreeStyleInput, id: string): string {
    if (!style.addressableElementIds.has(id)) return '';
    return ` ${DataAttribute.ELEMENT_ID}="${this.escapeHtml(id)}"`;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
