import { describe, expect, it } from 'vitest';
import { TemplatePreviewMock } from '@presentation/editor/services/TemplatePreviewMock';
import type { PreviewCaption } from '@presentation/editor/services/TemplatePreviewMock';

const mock = new TemplatePreviewMock();

function wordsBeingSaid(caption: PreviewCaption): string[] {
  return caption.segment.getWords()
    .filter((word) => word.getCssClasses(caption.restTime).includes('word-being-narrated'))
    .map((word) => word.text);
}

describe('the caption a template preview draws', () => {
  it('keeps a tile\'s lines and rests while its said word is being said', () => {
    const caption = mock.tileCaption({
      lines: [
        [{ text: 'This', tags: [], emoji: null, said: false }, { text: 'is', tags: [], emoji: null, said: false }],
        [{ text: 'Miso', tags: [], emoji: null, said: true }],
      ],
    }, false);
    expect(caption.segment.lines.map((line) => line.words.map((word) => word.text))).toEqual([['This', 'is'], ['Miso']]);
    expect(wordsBeingSaid(caption)).toEqual(['Miso']);
  });

  it('rests on the last word of a tile that marks none', () => {
    const caption = mock.tileCaption({
      lines: [[{ text: 'one', tags: [], emoji: null, said: false }, { text: 'two', tags: [], emoji: null, said: false }]],
    }, false);
    expect(wordsBeingSaid(caption)).toEqual(['two']);
  });

  it('gives a tile word its tags and its emoji', () => {
    const caption = mock.tileCaption({
      lines: [[{ text: 'Lewis', tags: ['emphasis'], emoji: '🔥', said: true }]],
    }, false);
    const [word] = caption.segment.getWords();
    expect(word?.getCssClasses(caption.restTime)).toContain('emphasis');
    expect(word?.decoration?.glyph).toBe('🔥');
  });

  it('plays a tile once over half a second a word', () => {
    const caption = mock.tileCaption({
      lines: [[{ text: 'a', tags: [], emoji: null, said: false }], [{ text: 'b', tags: [], emoji: null, said: false }]],
    }, false);
    expect(caption.duration).toBeCloseTo(1);
  });

  it('shows the name as one word being said', () => {
    expect(wordsBeingSaid(mock.nameCaption('Naya', false))).toEqual(['Naya']);
  });
});
