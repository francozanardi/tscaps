import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import type { Decoration } from '@modules/document/Decoration';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';

/** A word the segment subtree pulls out of line flow because its id carries an alignment override. */
export interface PositionedSubtreeWord {
  readonly word: Word;
  readonly line: Line;
  readonly indexInLine: number;
}

/** A decoration the segment subtree pulls out of line flow because its id carries an alignment override. */
export interface PositionedSubtreeDecoration {
  readonly word: Word;
  readonly line: Line;
  readonly indexInLine: number;
  readonly decoration: Decoration;
}

/**
 * The breakdown of a segment into the subtrees a consumer needs to
 * render: the words that move to their own anchor, the decorations
 * that move to their own anchor, the set of word ids the main subtree
 * skips, and whether every word in the segment has been positioned
 * (in which case the main subtree is skipped entirely so its
 * background chrome doesn't paint as an empty shell).
 */
export interface SegmentSubtreeDecomposition {
  readonly positionedWords: ReadonlyArray<PositionedSubtreeWord>;
  readonly positionedDecorations: ReadonlyArray<PositionedSubtreeDecoration>;
  readonly excludedWordIds: ReadonlySet<string>;
  readonly everyWordIsPositioned: boolean;
}

/**
 * Pure policy: given the segment and its style's word-level alignment
 * overrides, decides which words and decorations leave the main flow
 * and what the main subtree must skip. Stateless, DOM-free, side-
 * effect free.
 */
export class SegmentSubtreeDecomposer {

  decompose(segment: Segment, wordOverrides: ElementRenderOverrides): SegmentSubtreeDecomposition {
    const positionedWords = this.collectPositionedWords(segment, wordOverrides);
    const positionedDecorations = this.collectPositionedDecorations(segment, wordOverrides);
    const excludedWordIds = new Set(positionedWords.map((p) => p.word.id));
    const everyWordIsPositioned = this.allWordsExcluded(segment, excludedWordIds);
    return { positionedWords, positionedDecorations, excludedWordIds, everyWordIsPositioned };
  }

  private collectPositionedWords(segment: Segment, wordOverrides: ElementRenderOverrides): PositionedSubtreeWord[] {
    const out: PositionedSubtreeWord[] = [];
    for (const line of segment.lines) {
      for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
        const word = line.words[indexInLine]!;
        if (wordOverrides.get(word.id)?.alignment) out.push({ word, line, indexInLine });
      }
    }
    return out;
  }

  private collectPositionedDecorations(segment: Segment, wordOverrides: ElementRenderOverrides): PositionedSubtreeDecoration[] {
    const out: PositionedSubtreeDecoration[] = [];
    for (const line of segment.lines) {
      for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
        const word = line.words[indexInLine]!;
        const decoration = word.decoration;
        if (!decoration) continue;
        if (wordOverrides.get(decoration.id)?.alignment) out.push({ word, line, indexInLine, decoration });
      }
    }
    return out;
  }

  private allWordsExcluded(segment: Segment, excludedWordIds: ReadonlySet<string>): boolean {
    for (const line of segment.lines) {
      for (const word of line.words) {
        if (!excludedWordIds.has(word.id)) return false;
      }
    }
    return true;
  }
}
