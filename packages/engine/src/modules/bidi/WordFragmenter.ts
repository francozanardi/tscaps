import type { BidiAnalysis, BidiAnalyzer } from '@modules/bidi/BidiAnalyzer';
import type { BidiCharacterClassifier } from '@modules/bidi/BidiCharacterClassifier';
import type { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
import type { LineBaseDirectionResolver } from '@modules/bidi/LineBaseDirectionResolver';
import type { TextDirection } from '@modules/bidi/TextDirection';
import type { WordFragment } from '@modules/bidi/WordFragment';

const WORD_SEPARATOR = ' ';
const SEPARATOR_OWNER = -1;

/** A fragment before its place among the other fragments of its word is known. */
type UnmarkedFragment = Omit<WordFragment, 'carriesWordTail' | 'carriesWordBody'>;

/** Fragments of one word that paint one after another with nothing else between them. */
interface ContiguousGroup {
  readonly wordIndex: number;
  readonly fragmentIndices: number[];
  strongCharacterCount: number;
  characterCount: number;
}

/** A stretch of one word holding a single embedding level, as a slice of the joined line text. */
interface LevelRun {
  readonly wordIndex: number;
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
  readonly level: number;
}

/**
 * Lays the words of a single line out in the order they paint, splitting
 * any word that spans more than one bidi embedding level.
 *
 * Words arrive in spoken order and every fragment carries the index of
 * the word it came from, so timing, tags and per-word styling stay
 * attached to their word wherever its fragments land.
 *
 * A line of one script yields one fragment per word, in the same order
 * or its exact reverse. Mixed scripts interleave, and a word whose
 * punctuation resolves away from its letters splits in two that can end
 * up at opposite ends of the line.
 */
export class WordFragmenter {

  constructor(
    private readonly bidiAnalyzer: BidiAnalyzer,
    private readonly cursiveScriptDetector: CursiveScriptDetector,
    private readonly baseDirectionResolver: LineBaseDirectionResolver,
    private readonly characterClassifier: BidiCharacterClassifier,
  ) {}

  /**
   * Fragments of every word that has characters, ordered left to right
   * as they paint. A word with no characters paints nothing and yields
   * no fragment.
   *
   * The words are analyzed together as one line, because the direction
   * the algorithm resolves for a word depends on the words around it.
   *
   * `baseDirection` is what the captions declare. A line written
   * entirely in the other direction is laid out against that one
   * instead, so its own punctuation stays beside the word it belongs to.
   */
  fragment(words: ReadonlyArray<string>, baseDirection: TextDirection): ReadonlyArray<WordFragment> {
    if (words.length === 0) return [];
    const text = words.join(WORD_SEPARATOR);
    const analysis = this.bidiAnalyzer.analyze(text, this.baseDirectionResolver.resolve(text, baseDirection));
    const runs = this.splitIntoLevelRuns(words, analysis);
    return this.markFragments(this.walkPaintOrder(runs, analysis, text));
  }

  private splitIntoLevelRuns(words: ReadonlyArray<string>, analysis: BidiAnalysis): LevelRun[] {
    const runs: LevelRun[] = [];
    let cursor = 0;
    words.forEach((word, wordIndex) => {
      runs.push(...this.splitWordIntoLevelRuns(wordIndex, cursor, word.length, analysis));
      cursor += word.length + WORD_SEPARATOR.length;
    });
    return runs;
  }

  private splitWordIntoLevelRuns(
    wordIndex: number,
    start: number,
    length: number,
    analysis: BidiAnalysis,
  ): LevelRun[] {
    const runs: LevelRun[] = [];
    const end = start + length;
    let runStart = start;
    for (let i = start; i < end; i++) {
      const level = analysis.levels[i]!;
      if (i + 1 === end || analysis.levels[i + 1] !== level) {
        runs.push({ wordIndex, start: runStart, end: i + 1, level });
        runStart = i + 1;
      }
    }
    return runs;
  }

  /**
   * A run holds one level over consecutive characters, so its characters
   * paint consecutively too: reading the visual order once yields every
   * run exactly once, already in the order they appear on screen.
   */
  private walkPaintOrder(
    runs: ReadonlyArray<LevelRun>,
    analysis: BidiAnalysis,
    text: string,
  ): UnmarkedFragment[] {
    const ownerOf = this.buildRunOwnership(runs, text.length);
    const fragments: UnmarkedFragment[] = [];
    let previousOwner = SEPARATOR_OWNER;
    let separatorSeenSinceLastRun = false;

    for (const sourceIndex of analysis.visualOrder) {
      const owner = ownerOf[sourceIndex] ?? SEPARATOR_OWNER;
      if (owner === SEPARATOR_OWNER) {
        separatorSeenSinceLastRun = true;
      } else if (owner !== previousOwner) {
        const run = runs[owner]!;
        const fragmentText = text.slice(run.start, run.end);
        fragments.push({
          wordIndex: run.wordIndex,
          text: fragmentText,
          direction: this.directionOfLevel(run.level),
          joinedToPrevious: fragments.length > 0 && !separatorSeenSinceLastRun,
          charactersJoin: this.cursiveScriptDetector.isCursive(fragmentText),
        });
        separatorSeenSinceLastRun = false;
      }
      previousOwner = owner;
    }
    return fragments;
  }

  private markFragments(fragments: ReadonlyArray<UnmarkedFragment>): WordFragment[] {
    const tails = this.findWordTails(fragments);
    const bodies = this.findWordBodies(fragments);
    return fragments.map((fragment, index) => ({
      ...fragment,
      carriesWordTail: tails.has(index),
      carriesWordBody: bodies.has(index),
    }));
  }

  private findWordTails(fragments: ReadonlyArray<UnmarkedFragment>): Set<number> {
    const lastFragmentOfWord = new Map<number, number>();
    fragments.forEach((fragment, index) => lastFragmentOfWord.set(fragment.wordIndex, index));
    return new Set(lastFragmentOfWord.values());
  }

  /**
   * A word split across levels can still paint as one uninterrupted
   * stretch, and then every piece of it is body. Only when its pieces
   * land apart does one stretch hold the word and the others become
   * strays.
   */
  private findWordBodies(fragments: ReadonlyArray<UnmarkedFragment>): Set<number> {
    const bodyOfWord = new Map<number, ContiguousGroup>();
    for (const group of this.splitIntoContiguousGroups(fragments)) {
      const body = bodyOfWord.get(group.wordIndex);
      if (!body || this.outweighs(group, body)) bodyOfWord.set(group.wordIndex, group);
    }
    const bodies = new Set<number>();
    for (const group of bodyOfWord.values()) for (const index of group.fragmentIndices) bodies.add(index);
    return bodies;
  }

  private splitIntoContiguousGroups(fragments: ReadonlyArray<UnmarkedFragment>): ContiguousGroup[] {
    const groups: ContiguousGroup[] = [];
    fragments.forEach((fragment, index) => {
      const open = groups.at(-1);
      const group = open?.wordIndex === fragment.wordIndex
        ? open
        : this.openGroup(groups, fragment.wordIndex);
      group.fragmentIndices.push(index);
      group.strongCharacterCount += this.countStrongCharacters(fragment.text);
      group.characterCount += fragment.text.length;
    });
    return groups;
  }

  private openGroup(groups: ContiguousGroup[], wordIndex: number): ContiguousGroup {
    const group: ContiguousGroup = {
      wordIndex,
      fragmentIndices: [],
      strongCharacterCount: 0,
      characterCount: 0,
    };
    groups.push(group);
    return group;
  }

  /**
   * Letters decide, because the pieces that break off a word are the
   * neutrals around them. Length only settles a word with no letters at
   * all, such as a number carrying a full stop.
   */
  private outweighs(group: ContiguousGroup, body: ContiguousGroup): boolean {
    if (group.strongCharacterCount !== body.strongCharacterCount) {
      return group.strongCharacterCount > body.strongCharacterCount;
    }
    return group.characterCount > body.characterCount;
  }

  private countStrongCharacters(text: string): number {
    let count = 0;
    for (const character of text) {
      if (this.characterClassifier.strongDirectionOf(character) !== null) count++;
    }
    return count;
  }

  private buildRunOwnership(runs: ReadonlyArray<LevelRun>, textLength: number): number[] {
    const ownerOf = new Array<number>(textLength).fill(SEPARATOR_OWNER);
    runs.forEach((run, runIndex) => {
      for (let i = run.start; i < run.end; i++) ownerOf[i] = runIndex;
    });
    return ownerOf;
  }

  private directionOfLevel(level: number): TextDirection {
    return level % 2 === 0 ? 'ltr' : 'rtl';
  }
}
