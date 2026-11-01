import type { TextDirection } from '@modules/bidi/TextDirection';
import type { WordFragmenter } from '@modules/bidi/WordFragmenter';
import type { Line } from '@modules/document/Line';
import type { Segment } from '@modules/document/Segment';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import { InlineStyleEmitter } from '@modules/rendering/styles/InlineStyleEmitter';
import { BackgroundVideoFrameLayerMarkup } from '@modules/rendering/subtitle/BackgroundVideoFrameLayerMarkup';
import { ElementWidths } from '@modules/rendering/subtitle/ElementWidths';
import { SegmentSubtreeHtmlBuilder, type SegmentSubtreeStyleInput } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import { SubtreeIsolationMarks } from '@modules/rendering/subtitle/SubtreeIsolationMarks';
import type { WordSplitter } from '@modules/splitting/WordSplitter';

/** What a probe of one segment says about how it is painted, and when. */
export interface SegmentProbeMarkupInput {
  readonly segment: Segment;
  /** Its zero-based position among the segments of its kind, published as `--segment-index`. */
  readonly segmentIndex: number;
  /** The instant the markup stands at, which decides every state class and timing variable. */
  readonly t: number;
  /** The class the consuming stylesheet is scoped under, carried by the wrapper. */
  readonly scopeClass: string;
  /** Inline styles for the wrapper, typically the custom properties the stylesheet reads. */
  readonly wrapperStyles: Readonly<InlineStyleMap>;
  readonly textDirection: TextDirection;
  readonly splitWordsIntoLetters: boolean;
  /** Whether the painter puts its video frame layer first inside the segment. */
  readonly includeVideoFrameLayer: boolean;
  /**
   * Classes the painter appends to the segment for the state it is in.
   * A positioned word's copy of the segment never carries them.
   */
  readonly segmentStateClasses: ReadonlyArray<string>;
  /** Words painted alone at their own anchor instead of in their line. */
  readonly positionedWordIds: ReadonlySet<string>;
}

/** A word together with the line it belongs to and its place there. */
interface WordInLine {
  readonly line: Line;
  readonly indexInLine: number;
}

const NO_DECORATION_PLACEMENTS: ReadonlyMap<string, DecorationPlacementSide> = new Map();
const NO_CLASSES: ReadonlyArray<string> = [];

/**
 * The markup a word of one segment is painted in, for a consumer that
 * mounts it to ask the browser how a stylesheet resolves for its
 * elements.
 *
 * The same subtree the render paints — wrapper, segment, lines, words,
 * glyphs and letters, with the classes and variables of the instant
 * asked for — through the same builder, so the answer cannot drift
 * from what is painted. A word in its line is found in the segment with
 * every positioned word left out, the gap the render leaves for them; a
 * positioned word is found alone in the copy of its line the render
 * paints it in. Every element carries its element id, so it can be
 * found again once mounted.
 *
 * Left out, because a probe stands alone: nothing measured, nothing
 * isolated, no per-element overrides, and glyphs beside their words.
 * No custom property is dropped, since a probe cannot know which ones
 * its stylesheet reads.
 */
export class SegmentProbeMarkupBuilder {
  private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder;

  constructor(wordSplitter: WordSplitter, wordFragmenter: WordFragmenter) {
    this.subtreeBuilder = new SegmentSubtreeHtmlBuilder(wordSplitter, wordFragmenter, new BackgroundVideoFrameLayerMarkup());
  }

  /** The markup `wordId` is painted in, or the empty string when the segment holds no such word. */
  build(input: SegmentProbeMarkupInput, wordId: string): string {
    const place = this.placeOf(input.segment, wordId);
    if (place === null) return '';
    return input.positionedWordIds.has(wordId) ? this.positionedCopy(input, place) : this.segmentWithGaps(input);
  }

  private segmentWithGaps(input: SegmentProbeMarkupInput): string {
    return this.subtreeBuilder.buildSegmentSubtree(
      this.styleInput(input, input.segmentStateClasses),
      input.segment,
      input.t,
      input.positionedWordIds,
      input.segmentIndex,
    );
  }

  private positionedCopy(input: SegmentProbeMarkupInput, place: WordInLine): string {
    return this.subtreeBuilder.buildSingleWordSubtree(
      this.styleInput(input, NO_CLASSES),
      input.segment,
      place.line,
      place.line.words[place.indexInLine]!,
      input.t,
      input.segmentIndex,
      place.indexInLine,
    );
  }

  private placeOf(segment: Segment, wordId: string): WordInLine | null {
    for (const line of segment.lines) {
      const indexInLine = line.words.findIndex((word) => word.id === wordId);
      if (indexInLine >= 0) return { line, indexInLine };
    }
    return null;
  }

  private styleInput(input: SegmentProbeMarkupInput, segmentClasses: ReadonlyArray<string>): SegmentSubtreeStyleInput {
    return {
      scopeClass: input.scopeClass,
      baseInlineStyles: input.wrapperStyles,
      segmentInlineStyles: {},
      subtreeOverrides: ElementRenderOverrides.empty(),
      splitWordsIntoLetters: input.splitWordsIntoLetters,
      includeVideoFrameLayer: input.includeVideoFrameLayer,
      extraWrapperStyles: {},
      extraSegmentClasses: segmentClasses,
      decorationPlacements: NO_DECORATION_PLACEMENTS,
      inlineStyleEmitter: new InlineStyleEmitter(null),
      textDirection: input.textDirection,
      addressableElementIds: this.everyElementId(input.segment),
      elementWidths: ElementWidths.empty(),
      isolationMarks: SubtreeIsolationMarks.none(),
    };
  }

  private everyElementId(segment: Segment): ReadonlySet<string> {
    const ids = new Set<string>([segment.id]);
    for (const line of segment.lines) {
      ids.add(line.id);
      for (const word of line.words) {
        ids.add(word.id);
        if (word.decoration !== null) ids.add(word.decoration.id);
      }
    }
    return ids;
  }
}
