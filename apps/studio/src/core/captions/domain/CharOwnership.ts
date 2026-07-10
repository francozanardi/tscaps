import type { Segment } from '@tscaps/engine';
import type { CharEdit } from '@core/captions/domain/CharEdit';

/**
 * Per-char map from textarea position to `Word.id`, `null` for joiner
 * whitespace. Char-level (not word-level) so the recompiler can keep
 * a word's identity through small text edits and disambiguate which
 * one was deleted when several share the same string.
 */
export class CharOwnership {
  readonly mapping: ReadonlyArray<string | null>;

  constructor(mapping: ReadonlyArray<string | null>) {
    this.mapping = mapping;
  }

  static fromSegment(segment: Segment): { text: string; ownership: CharOwnership } {
    const chars: string[] = [];
    const mapping: (string | null)[] = [];
    for (let li = 0; li < segment.lines.length; li++) {
      const line = segment.lines[li]!;
      if (li > 0) {
        chars.push('\n');
        mapping.push(null);
      }
      const tokens = line.words.filter((w) => w.text.length > 0);
      for (let wi = 0; wi < tokens.length; wi++) {
        const word = tokens[wi]!;
        if (wi > 0) {
          chars.push(' ');
          mapping.push(null);
        }
        for (let i = 0; i < word.text.length; i++) {
          chars.push(word.text[i]!);
          mapping.push(word.id);
        }
      }
    }
    return { text: chars.join(''), ownership: new CharOwnership(mapping) };
  }

  applyDelta(edits: ReadonlyArray<CharEdit>): CharOwnership {
    const next: (string | null)[] = [];
    for (const edit of edits) {
      if (edit.type === 'keep') {
        for (let i = edit.oldStart; i < edit.oldEnd; i++) {
          next.push(this.mapping[i] ?? null);
        }
      } else if (edit.type === 'insert') {
        const len = edit.newEnd - edit.newStart;
        for (let i = 0; i < len; i++) next.push(null);
      }
      // 'delete' contributes nothing
    }
    return new CharOwnership(next);
  }
}
