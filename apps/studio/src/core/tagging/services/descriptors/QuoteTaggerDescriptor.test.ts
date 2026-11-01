import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { QuoteTaggerDescriptor } from '@core/tagging/services/descriptors/QuoteTaggerDescriptor';

async function quotedWords(text: string): Promise<string[]> {
  const words = text.split(' ').map((word, index) => new Word({ text: word, time: new TimeFragment(index, index + 1) }));
  const document = new Document({
    sections: [new Section({ kind: '', segments: [new Segment({ lines: [new Line({ words })] })] })],
  });
  const tagged = await new QuoteTaggerDescriptor().apply(document);
  return tagged
    .getWords()
    .filter((word) => [...word.semanticTags].some((tag) => tag.name === 'quote'))
    .map((word) => word.text);
}

describe('QuoteTaggerDescriptor', () => {
  it('tags an English quote with the punctuation inside the marks', async () => {
    expect(await quotedWords('she said "stop right there," and left')).toEqual(['"stop', 'right', 'there,"']);
  });

  it('tags a Spanish quote whose punctuation follows the closing mark', async () => {
    expect(await quotedWords('me dijo «no puedo», y se fue')).toEqual(['«no', 'puedo»,']);
    expect(await quotedWords('y gritó "basta ya".')).toEqual(['"basta', 'ya".']);
  });

  it('tags a Spanish quote whose opening mark follows other punctuation', async () => {
    expect(await quotedWords('y entonces ¿«qué hacemos»? nada')).toEqual(['¿«qué', 'hacemos»?']);
  });

  it('leaves a quote that never closes untagged', async () => {
    expect(await quotedWords('me dijo «no puedo y se fue')).toEqual([]);
  });
});
