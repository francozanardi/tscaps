import { describe, expect, it } from 'vitest';
import { JsonWordTimingsSubtitleFileReader } from '@core/transcription/infrastructure/JsonWordTimingsSubtitleFileReader';
import { SkippedCueBlocksStore } from '@core/transcription/store/SkippedCueBlocksStore';
import { SubtitleFileReadFailedError } from '@core/transcription/domain/errors/SubtitleFileReadFailedError';

function timings(words: ReadonlyArray<{ text: string; time: { start: number; end: number } }>): Array<[string, number, number]> {
  return words.map((word) => [word.text, word.time.start, word.time.end]);
}

describe('JsonWordTimingsSubtitleFileReader', () => {
  it('reads a list of words at the top, trimming the space a transcriber puts before each', async () => {
    const reader = new JsonWordTimingsSubtitleFileReader(new SkippedCueBlocksStore());
    const text = JSON.stringify({ text: 'Hello there', words: [{ word: ' Hello', start: 1, end: 1.4 }, { word: ' there', start: 1.4, end: 2 }] });

    const document = await reader.read({ name: 'talk.json', text });

    expect(timings(document.getWords())).toEqual([['Hello', 1, 1.4], ['there', 1.4, 2]]);
  });

  it('reads the words of every segment, in order', async () => {
    const reader = new JsonWordTimingsSubtitleFileReader(new SkippedCueBlocksStore());
    const text = JSON.stringify({ segments: [
      { text: 'Hello there', words: [{ word: 'Hello', start: 1, end: 1.4 }, { word: 'there', start: 1.4, end: 2 }] },
      { text: 'General Kenobi', words: [{ word: 'General', start: 3, end: 3.5 }, { word: 'Kenobi', start: 3.5, end: 4.2 }] },
    ] });

    const document = await reader.read({ name: 'talk.json', text });

    expect(timings(document.getWords())).toEqual([['Hello', 1, 1.4], ['there', 1.4, 2], ['General', 3, 3.5], ['Kenobi', 3.5, 4.2]]);
  });

  it('reads a bare list of words that name their text as text', async () => {
    const reader = new JsonWordTimingsSubtitleFileReader(new SkippedCueBlocksStore());
    const text = JSON.stringify([{ text: 'Hello', start: 0.5, end: 0.9 }]);

    const document = await reader.read({ name: 'talk.json', text });

    expect(timings(document.getWords())).toEqual([['Hello', 0.5, 0.9]]);
  });

  it('reads a file saved with a byte order mark', async () => {
    const reader = new JsonWordTimingsSubtitleFileReader(new SkippedCueBlocksStore());
    const text = `\uFEFF${JSON.stringify({ words: [{ word: 'Hello', start: 1, end: 1.4 }] })}`;

    const document = await reader.read({ name: 'talk.json', text });

    expect(timings(document.getWords())).toEqual([['Hello', 1, 1.4]]);
  });

  it('leaves out a word it cannot place, and records it as skipped', async () => {
    const skipped = new SkippedCueBlocksStore();
    const reader = new JsonWordTimingsSubtitleFileReader(skipped);
    const text = JSON.stringify({ words: [{ word: 'Hello', start: 1, end: 1.4 }, { word: 'there', start: 2 }, { word: 'again', start: 3, end: 2.5 }] });

    const document = await reader.read({ name: 'talk.json', text });

    expect(timings(document.getWords())).toEqual([['Hello', 1, 1.4]]);
    expect(skipped.snapshot()).toEqual(['there', 'again']);
  });

  it('fails a file that is not JSON, has no words, or has none it can place', async () => {
    const reader = new JsonWordTimingsSubtitleFileReader(new SkippedCueBlocksStore());

    await expect(reader.read({ name: 'a.json', text: '{ not json' })).rejects.toBeInstanceOf(SubtitleFileReadFailedError);
    await expect(reader.read({ name: 'b.json', text: '{"text":"Hello"}' })).rejects.toBeInstanceOf(SubtitleFileReadFailedError);
    await expect(reader.read({ name: 'c.json', text: '{"words":[{"word":"Hello"}]}' })).rejects.toBeInstanceOf(SubtitleFileReadFailedError);
  });
});
