import type { Word } from '@tscaps/engine';
import { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';

interface SplitText {
  readonly base: string;
  readonly trailing: string;
}

interface AbsorbedWordState {
  readonly displayText: string;
  readonly trail: string;
}

/**
 * Final post-effect pass that keeps each decorated word's `trail` field
 * in sync with the host sheet's emoji-placement mode.
 *
 * When the sheet renders emojis inline next to the word
 * (`placement === 'word'`), trailing punctuation is moved off the word's
 * `displayText` onto the decoration's `trail`. The renderer paints
 * `trail` right after the glyph but outside the decoration's style
 * scope, so a mid-sentence comma reads as `cats 🐱, and dogs` instead
 * of detaching the emoji with `cats, 🐱 and dogs`.
 *
 * When the sheet renders emojis above or below the segment, `trail` is
 * cleared on every decorated word so the comma stays in the word's
 * text. Without this clearing step, a trail set under a previous
 * inline-placement derivation would survive and render twice.
 *
 * Idempotent: the trailing run is re-derived from the original `text`
 * each pass (the deriver resets `displayText` to `text` before effects
 * run), so successive derivations converge to the same `displayText`
 * and `trail`.
 */
export class InlineEmojiPunctuationAbsorber {
  private static readonly TRAILING_PUNCTUATION = /[,.;:!?"]+$/;

  absorb(document: Document, sheetById: ReadonlyMap<string, Sheet>): Document {
    return document.with({ sections: document.sections.map((section) => {
      const inlineEmojiEnabled = this.isInlineEmojiEnabledForSection(section.kind, sheetById);
      return section.with({ segments: section.segments.map((segment) =>
        segment.with({ lines: segment.lines.map((line) =>
          line.with({ words: line.words.map((word) => this.absorbWord(word, inlineEmojiEnabled)) }),
        ) }),
      ) });
    }) });
  }

  private isInlineEmojiEnabledForSection(sectionKind: string, sheetById: ReadonlyMap<string, Sheet>): boolean {
    const sheet = sheetById.get(sectionKind);
    if (!sheet) return false;
    const config = sheet.effectConfig('emoji');
    return config !== null && config.enabled && config.placement === 'word';
  }

  private absorbWord(word: Word, inlineEmojiEnabled: boolean): Word {
    const decoration = word.decoration;
    if (!decoration) return word;
    const next = this.resolveNextState(word.displayText, inlineEmojiEnabled);
    if (next.displayText === word.displayText && next.trail === decoration.trail) return word;
    return word.with({
      displayText: next.displayText,
      decoration: decoration.with({ trail: next.trail }),
    });
  }

  private resolveNextState(displayText: string, inlineEmojiEnabled: boolean): AbsorbedWordState {
    if (!inlineEmojiEnabled) return { displayText, trail: '' };
    const split = this.splitTrailingPunctuation(displayText);
    if (!split.base) return { displayText, trail: '' };
    return { displayText: split.base, trail: split.trailing };
  }

  private splitTrailingPunctuation(text: string): SplitText {
    const match = text.match(InlineEmojiPunctuationAbsorber.TRAILING_PUNCTUATION);
    const trailing = match ? match[0] : '';
    const base = trailing ? text.slice(0, -trailing.length) : text;
    return { base, trailing };
  }
}
