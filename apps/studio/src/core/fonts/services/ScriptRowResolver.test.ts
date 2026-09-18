import { describe, expect, it } from 'vitest';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { ScriptRowResolver } from '@core/fonts/services/ScriptRowResolver';

const resolver = new ScriptRowResolver(new FontScriptClassifier());

/**
 * Which font pickers a caption asks for, and which of them leads.
 *
 * The order is the whole control: the first script gets the picker that
 * is always on screen, and the rest are folded behind an affordance
 * somebody writing in one alphabet never sees.
 */

describe('the alphabets a text asks for a face for', () => {
  it('leads with the one it holds most characters of', () => {
    expect(resolver.resolve('привет hi', false)[0]).toBe('cyrillic');
    expect(resolver.resolve('hello привет мир but mostly latin here', false)[0]).toBe('latin');
  });

  it('names every alphabet the text holds', () => {
    expect(new Set(resolver.resolve('hello שלום مرحبا', false))).toEqual(
      new Set(['latin', 'hebrew', 'arabic']),
    );
  });

  it('updates the rows as text adds, changes dominance, and removes a script', () => {
    expect(resolver.resolve('hello', false)).toEqual(['latin']);
    expect(resolver.resolve('hello мир', false)).toEqual(['latin', 'cyrillic']);
    expect(resolver.resolve('hi привет мир', false)).toEqual(['cyrillic', 'latin']);
    expect(resolver.resolve('привет мир', false)).toEqual(['cyrillic']);
  });

  it('does not add an alphabet picker for script-specific digits alone', () => {
    expect(resolver.resolve('hello ١٢٣', false)).toEqual(['latin']);
  });

  it('names one alphabet for a text written in one', () => {
    expect(resolver.resolve('the quick brown fox', false)).toEqual(['latin']);
  });

  it.each([
    ['বাংলা', 'bengali'],
    ['తెలుగు', 'telugu'],
    ['தமிழ்', 'tamil'],
    ['ภาษาไทย', 'thai'],
  ] as const)('recognizes %s as the managed %s row', (text, script) => {
    expect(resolver.resolve(text, false)).toEqual([script]);
  });

  it('groups every unsupported writing system in one row', () => {
    expect(resolver.resolve('日本語 한국어', false)).toEqual(['other']);
  });

  it('keeps the managed rows and adds one shared row for unsupported letters', () => {
    expect(resolver.resolve('hello 世界 한국어', false)).toEqual(['latin', 'other']);
  });

  it('leads with Other when unsupported letters dominate', () => {
    expect(resolver.resolve('hi 日本語の字幕です', false)).toEqual(['other', 'latin']);
  });

  // Punctuation and digits render in any face, so they carry no vote and
  // cannot conjure a picker of their own.
  it('ignores characters that belong to no alphabet', () => {
    expect(resolver.resolve('123 — !?', false)).toEqual(['latin']);
    expect(resolver.resolve('', false)).toEqual(['latin']);
  });
});

/**
 * Urdu is the Arabic script written in another tradition, and no letter
 * separates the two — only the language does. So it arrives from the
 * captions around the text rather than from the text, and a caption
 * never asks for both at once.
 */
describe('a caption whose language settles it as Urdu', () => {
  it('asks for the Urdu face where it would have asked for the Arabic one', () => {
    expect(resolver.resolve('ہم مصروف ہیں', true)).toEqual(['urdu']);
  });

  it('never asks for both', () => {
    const scripts = resolver.resolve('hello ہم مصروف ہیں', true);
    expect(scripts).toContain('urdu');
    expect(scripts).not.toContain('arabic');
  });

  it('leaves the other alphabets it holds alone', () => {
    expect(new Set(resolver.resolve('hello ہم مصروف', true))).toEqual(new Set(['latin', 'urdu']));
  });
});
