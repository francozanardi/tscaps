import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

export interface BalancedLineSplitterConfig {
  maxLines: number;
  minLines: number;
  maxCharsPerLine: number;
}

/**
 * BalancedLineSplitter implements a line-breaking strategy that aims to distribute
 * words across lines in a way that minimizes the difference in character count
 * between lines, while respecting specified constraints on maximum lines,
 * minimum lines, and maximum characters per line.
 */
export class BalancedLineSplitter implements LineSplitter {
  constructor(private readonly _config: BalancedLineSplitterConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.map((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment {
    const words = segment.getWords();
    if (words.length === 0) return segment;

    const lines = this.buildLines(words);
    this.adjustToMinLines(lines);
    return segment.with({ lines });
  }

  private buildLines(words: Word[]): Line[] {
    const { maxLines, maxCharsPerLine } = this._config;
    const totalChars = this.charCount(words);
    const linesNeeded = Math.ceil(totalChars / maxCharsPerLine);
    const targetLines = Math.min(linesNeeded, maxLines);

    if (targetLines <= 1) {
      return [new Line({ words })];
    }

    return this.splitRecursive(words, targetLines);
  }

  private splitRecursive(words: Word[], linesLeft: number): Line[] {
    if (linesLeft <= 1 || words.length === 0) {
      return words.length > 0 ? [new Line({ words })] : [];
    }

    const total = this.charCount(words);
    const target = total / linesLeft;

    let bestSplit = 1;
    let bestDiff = Infinity;
    let cumChars = 0;

    for (let i = 0; i < words.length - 1; i++) {
      const word = words[i];
      if (!word) continue;
      cumChars += i === 0 ? word.text.length : word.text.length + 1;
      const diff = Math.abs(cumChars - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSplit = i + 1;
      }
    }

    return [
      new Line({ words: words.slice(0, bestSplit) }),
      ...this.splitRecursive(words.slice(bestSplit), linesLeft - 1),
    ];
  }

  private adjustToMinLines(lines: Line[]): void {
    const { minLines } = this._config;
    while (lines.length < minLines) {
      let longestIdx = 0;
      for (let i = 1; i < lines.length; i++) {
        if ((lines[i]?.words.length ?? 0) > (lines[longestIdx]?.words.length ?? 0)) {
          longestIdx = i;
        }
      }

      const longest = lines[longestIdx];
      if (!longest || longest.words.length <= 1) break;

      const mid = Math.floor(longest.words.length / 2);
      const first = new Line({ words: [...longest.words].slice(0, mid) });
      const second = new Line({ words: [...longest.words].slice(mid) });
      lines.splice(longestIdx, 1, first, second);
    }
  }

  private charCount(words: Word[]): number {
    return words.reduce((sum, w, i) => sum + w.text.length + (i > 0 ? 1 : 0), 0);
  }
}
