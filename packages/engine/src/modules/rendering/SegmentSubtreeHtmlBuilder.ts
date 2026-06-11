import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import { CssVariable } from '@modules/document/CssVariable';
import { Letter } from '@modules/document/Letter';
import type { InlineStyleMap } from '@modules/rendering/InlineStyleMap';
import type { ElementRenderOverrides } from '@modules/rendering/ElementRenderOverrides';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { VIDEO_FRAME_LAYER_CLASS } from '@modules/rendering/VideoFrameLayerClass';

const HTML_ATTR_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Common per-style inputs every build call needs.
 */
export interface SegmentSubtreeStyleInput {
  readonly scopeClass: string;
  readonly baseInlineStyles: InlineStyleMap;
  readonly wordOverrides: ElementRenderOverrides;
  readonly splitWordsIntoLetters: boolean;
  readonly includeVideoFrameLayer: boolean;
  readonly extraWrapperStyles: InlineStyleMap;
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
   * neighbours reflow into the freed slot. The caller is expected to
   * render those words elsewhere (e.g. via `buildSingleWordSubtree`).
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
    const innerHtml = this.maybeVideoFrameLayerHtml(style) + linesHtml;
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
    const lineClasses = line.getCssClasses(t).join(' ');
    const lineStyle = this.serializeAnimatedVars(line.getCssVariables(t));
    const lineHtml = `<div class="${lineClasses}" style="${lineStyle}">${wordHtml}</div>`;
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
    const segHtml = this.composeSegmentHtml(seg, t, innerHtml);
    return `<div class="${style.scopeClass}" style="${wrapperStyle}">${segHtml}</div>`;
  }

  private composeWrapperStyle(style: SegmentSubtreeStyleInput): string {
    const merged: InlineStyleMap = { ...style.baseInlineStyles, ...style.extraWrapperStyles };
    const inlineStyleString = Object.entries(merged)
      .map(([k, v]) => `${k}: ${this.escapeHtmlAttrValue(v)}`)
      .join('; ');
    return `display: inline-block; width: max-content; min-width: 0; min-height: 0; ${inlineStyleString}`;
  }

  private composeSegmentHtml(seg: Segment, t: number, innerHtml: string): string {
    const classes = seg.getCssClasses(t).join(' ');
    const segStyle = this.serializeAnimatedVars(seg.getCssVariables(t));
    return `<div class="${classes}" style="${segStyle}">${innerHtml}</div>`;
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
    const classes = line.getCssClasses(t).join(' ');
    const lineStyle = this.serializeAnimatedVars(line.getCssVariables(t));
    const wordsHtml = visibleWords.map((word) => this.buildWordHtml(style, word, t)).join('');
    return `<div class="${classes}" style="${lineStyle}">${wordsHtml}</div>`;
  }

  // Lives inside `.segment` so the segment's own clipping and
  // stacking context apply to the layer the same way they apply
  // to any other child.
  private maybeVideoFrameLayerHtml(style: SegmentSubtreeStyleInput): string {
    return style.includeVideoFrameLayer
      ? `<div class="${VIDEO_FRAME_LAYER_CLASS}"></div>`
      : '';
  }

  private buildWordHtml(style: SegmentSubtreeStyleInput, word: Word, t: number): string {
    const wordClasses = word.getCssClasses(t);
    const wordVars = word.getCssVariables(t);
    const overrideStyle = this.inlineStyleToString(style.wordOverrides.get(word.id)?.inlineStyles);

    if (!style.splitWordsIntoLetters) {
      const wordStyle = this.serializeAnimatedVars(wordVars) + overrideStyle;
      return `<span class="${wordClasses.join(' ')}" style="${wordStyle}">${this.escapeHtml(word.displayText)}</span>`;
    }

    const letters = this.wordSplitter.split(word.displayText);
    const wordStyle = this.serializeAnimatedVars({ ...wordVars, [CssVariable.LETTER_COUNT]: String(letters.length) }) + overrideStyle;
    const lettersHtml = letters.map((letter, i) => {
      const letterStyle = this.serializeAnimatedVars({ [CssVariable.LETTER_INDEX]: String(i) });
      return `<span class="${Letter.CSS_CLASS}" style="${letterStyle}">${this.escapeHtml(letter)}</span>`;
    }).join('');
    return `<span class="${wordClasses.join(' ')}" style="${wordStyle}">${lettersHtml}</span>`;
  }

  private serializeAnimatedVars(vars: Record<string, string>): string {
    let result = 'animation-play-state: paused; animation-fill-mode: both; ';
    for (const [k, v] of Object.entries(vars)) result += `${k}: ${this.escapeHtmlAttrValue(v)}; `;
    return result;
  }

  private inlineStyleToString(styles: Readonly<Record<string, string>> | undefined): string {
    if (!styles) return '';
    let result = '';
    for (const [k, v] of Object.entries(styles)) result += `${k}: ${this.escapeHtmlAttrValue(v)}; `;
    return result;
  }

  // A bare `"` inside an attribute value (e.g. a user-typed caption)
  // would close the surrounding `style="..."` attribute and leave the
  // HTML malformed.
  private escapeHtmlAttrValue(value: string): string {
    return value.replace(/[&"<>]/g, (c) => HTML_ATTR_ENTITIES[c]!);
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
