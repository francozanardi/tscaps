import { describe, expect, it } from 'vitest';
import { BidiJsAnalyzer } from '@modules/bidi/BidiJsAnalyzer';
import { BidiJsCharacterClassifier } from '@modules/bidi/BidiJsCharacterClassifier';
import { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
import { LineBaseDirectionResolver } from '@modules/bidi/LineBaseDirectionResolver';
import { WordFragmenter } from '@modules/bidi/WordFragmenter';
import type { TextDirection } from '@modules/bidi/TextDirection';

const fragmenter = new WordFragmenter(
  new BidiJsAnalyzer(),
  new CursiveScriptDetector(),
  new LineBaseDirectionResolver(new BidiJsCharacterClassifier()),
  new BidiJsCharacterClassifier(),
);

/** `text|direction` per fragment, in painting order. */
function paint(words: ReadonlyArray<string>, baseDirection: TextDirection): string[] {
  return fragmenter.fragment(words, baseDirection).map((f) => `${f.text}|${f.direction}`);
}

// The expectations below were taken from a run comparing this class's output
// against what Chromium and Firefox actually lay out for the same text. They
// describe the browsers' behaviour, not this implementation's. Which base a
// line is laid out against is the one thing chosen here rather than read off a
// browser; given that base, the layout is still theirs.
describe('WordFragmenter', () => {

  it('leaves a left-to-right line in spoken order', () => {
    expect(paint(['The', 'quick', 'brown', 'fox'], 'ltr'))
      .toEqual(['The|ltr', 'quick|ltr', 'brown|ltr', 'fox|ltr']);
  });

  it('reverses a right-to-left line', () => {
    expect(paint(['مرحبا', 'بكم', 'في', 'تسكابس'], 'rtl'))
      .toEqual(['تسكابس|rtl', 'في|rtl', 'بكم|rtl', 'مرحبا|rtl']);
  });

  it('keeps an embedded foreign phrase reading in its own direction', () => {
    expect(paint(['قرأت', 'كتاب', 'The', 'Great', 'Gatsby', 'أمس'], 'rtl'))
      .toEqual(['أمس|rtl', 'The|ltr', 'Great|ltr', 'Gatsby|ltr', 'كتاب|rtl', 'قرأت|rtl']);
  });

  it('keeps an embedded right-to-left phrase in a left-to-right line', () => {
    expect(paint(['He', 'said', 'مرحبا', 'بكم', 'and', 'left.'], 'ltr'))
      .toEqual(['He|ltr', 'said|ltr', 'بكم|rtl', 'مرحبا|rtl', 'and|ltr', 'left.|ltr']);
  });

  it('places a foreign name by the base direction, not by its own script', () => {
    expect(paint(['tscaps', 'هو', 'الأفضل'], 'rtl'))
      .toEqual(['الأفضل|rtl', 'هو|rtl', 'tscaps|ltr']);
    expect(paint(['tscaps', 'هو', 'الأفضل'], 'ltr'))
      .toEqual(['tscaps|ltr', 'الأفضل|rtl', 'هو|rtl']);
  });

  it('keeps a closing full stop with its word when the base direction agrees', () => {
    expect(paint(['مرحبا', 'بكم', 'تسكابس.'], 'rtl'))
      .toEqual(['تسكابس.|rtl', 'بكم|rtl', 'مرحبا|rtl']);
  });

  // A closing full stop is neutral: at the end of a right-to-left line its
  // neighbours disagree, so it takes the line's own level and paints at the far
  // end, three words away from the letters it belongs to. Both pieces still
  // answer to that word.
  it('splits a word whose punctuation resolves away from its letters', () => {
    expect(paint(['مرحبا', 'this', 'is', 'a', 'test.'], 'rtl'))
      .toEqual(['.|rtl', 'this|ltr', 'is|ltr', 'a|ltr', 'test|ltr', 'مرحبا|rtl']);

    const fragments = fragmenter.fragment(['مرحبا', 'this', 'is', 'a', 'test.'], 'rtl');
    const pieces = fragments.filter((f) => f.wordIndex === 4);
    expect(pieces).toHaveLength(2);
    expect(pieces.filter((f) => f.carriesWordTail)).toHaveLength(1);
  });

  // The declared direction states the language of the captions, so a line
  // holding none of that language is laid out against its own. Nothing about
  // the words moves — only where the line's edge punctuation lands.
  it('lays out a line written entirely in the other direction against that one', () => {
    expect(paint(['This', 'is', 'a', 'test.'], 'rtl'))
      .toEqual(['This|ltr', 'is|ltr', 'a|ltr', 'test.|ltr']);
    expect(paint(['مرحبا', 'بكم', 'تسكابس.'], 'ltr'))
      .toEqual(['تسكابس.|rtl', 'بكم|rtl', 'مرحبا|rtl']);
  });

  // A stray piece answers to its word for the clock, and says it is a stray so
  // a decoration pointing at the word can leave it alone: a pill drawn on it
  // would sit three words away from the letters it names.
  it('marks a piece painting away from the rest of its word', () => {
    const fragments = fragmenter.fragment(['مرحبا', 'this', 'is', 'a', 'test.'], 'rtl');
    const bodies = new Map(fragments.map((f) => [f.text, f.carriesWordBody]));
    expect(bodies.get('test')).toBe(true);
    expect(bodies.get('.')).toBe(false);
    expect(bodies.get('this')).toBe(true);
  });

  // The pieces of these words paint flush against each other, so each word is
  // one unbroken stretch and a pill drawn over it covers all of it.
  it('leaves every piece of a word that paints in one stretch as body', () => {
    for (const words of [['هل', 'جربت', 'ChatGPT؟'], ['شاهد', 'الفيديو', 'YouTube!']]) {
      const fragments = fragmenter.fragment(words, 'rtl');
      expect(fragments.length).toBeGreaterThan(words.length);
      expect(fragments.every((f) => f.carriesWordBody)).toBe(true);
    }
  });

  // Digits are not strong characters, so neither stretch of `12345.` has
  // letters to weigh and the longer one takes the word.
  it('gives the word to the longer stretch when neither has letters', () => {
    const fragments = fragmenter.fragment(['مرحبا', 'costs', 'about', '12345.'], 'rtl');
    const bodies = new Map(fragments.map((f) => [f.text, f.carriesWordBody]));
    expect(bodies.get('12345')).toBe(true);
    expect(bodies.get('.')).toBe(false);
  });

  it('keeps the declared direction for a line with no directional characters', () => {
    expect(paint(['2026.', '!!'], 'rtl')).toEqual(['!!|rtl', '.|rtl', '2026|ltr']);
    expect(paint(['2026.', '!!'], 'ltr')).toEqual(['2026.|ltr', '!!|ltr']);
  });

  it('splits brackets away from the phrase they wrap and closes the gap', () => {
    expect(paint(['نشرت', 'على', '(Product', 'Hunt)', 'أمس.'], 'rtl'))
      .toEqual(['أمس.|rtl', ')|rtl', 'Product|ltr', 'Hunt|ltr', '(|rtl', 'على|rtl', 'نشرت|rtl']);

    const fragments = fragmenter.fragment(['نشرت', 'على', '(Product', 'Hunt)', 'أمس.'], 'rtl');
    // No word separator paints between the bracket and the word beside it, so
    // the inter-word gap must not open there.
    expect(fragments.map((f) => f.joinedToPrevious))
      .toEqual([false, false, true, false, true, false, false]);
  });

  it('marks exactly one tail fragment per word', () => {
    const fragments = fragmenter.fragment(['قال', '[The', '"Big"', 'One]', 'ثم', 'صمت'], 'rtl');
    const tailsPerWord = new Map<number, number>();
    for (const fragment of fragments) {
      if (!fragment.carriesWordTail) continue;
      tailsPerWord.set(fragment.wordIndex, (tailsPerWord.get(fragment.wordIndex) ?? 0) + 1);
    }
    expect([...tailsPerWord.values()]).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('reports which fragments are written in a joining script', () => {
    const fragments = fragmenter.fragment(['قرأت', 'The', 'שלום'], 'rtl');
    const joining = new Map(fragments.map((f) => [f.text, f.charactersJoin]));
    expect(joining.get('قرأت')).toBe(true);
    expect(joining.get('The')).toBe(false);
    expect(joining.get('שלום')).toBe(false);
  });

  it('yields nothing for an empty line and skips words with no characters', () => {
    expect(fragmenter.fragment([], 'rtl')).toEqual([]);
    expect(paint(['', 'مرحبا', ''], 'rtl')).toEqual(['مرحبا|rtl']);
  });
});
