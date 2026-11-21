import { describe, expect, it } from 'vitest';
import { Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { ReadOperationsFixture } from '@core/editor-operations/testing/ReadOperationsFixture';

/**
 * The captions as they are shown, at three details: text with a time
 * every ten seconds, one line per segment with every word's ref, or each
 * word as `[ref, text, startSec, endSec, extras?]`. The last two read at
 * most a minute at a time. Reading changes nothing.
 */
describe('get_transcript', () => {
  it('tells an emoji on screen from one transcription suggested that its sheet does not show', async () => {
    const fixture = new ReadOperationsFixture();
    const hidden = await fixture.getTranscript().run({ detail: 'timed' });
    const main = fixture.store.sheet('main')!;
    fixture.store.patch({
      sheets: fixture.store.snapshot().sheets.map((sheet) => (sheet.id === 'main'
        ? main.with({ effectConfigs: [{ type: 'emoji', enabled: true, placement: 'segment-below', size: 1.8, gap: 0.1 }] })
        : sheet)),
    });
    const shown = await fixture.getTranscript().run({ detail: 'timed' });

    const worldOf = (result: typeof hidden) => (result.output as { segments: Array<{ words: unknown[][] }> }).segments[0]!.words[1];
    expect(worldOf(hidden)).toEqual(['word:w2', 'world', 0.5, 1, { suggestedEmoji: '🔥' }]);
    expect(worldOf(shown)).toEqual(['word:w2', 'world', 0.5, 1, { emoji: '🔥', decoration: 'decoration:w2:d' }]);
  });

  it('speaks only of the suggestion a caption would show, and of the other once a split gives it a caption of its own', async () => {
    const fixture = new ReadOperationsFixture();
    const [hello, world] = fixture.store.snapshot().document!.getWords();
    const greeting = [hello!.with({ decoration: new Decoration({ id: 'w1:d', glyph: '👋' }) }), world!];
    const captions = (segments: ReadonlyArray<ReadonlyArray<Word>>) => new Document({
      sections: [new Section({ kind: 'main', segments: segments.map((words, index) => new Segment({ id: `c${index + 1}`, lines: [new Line({ words: [...words] })] })) })],
    });
    const wordsOf = async () => (await fixture.getTranscript().run({ detail: 'words' })).output as { captions: string };

    fixture.store.patch({ document: captions([greeting]) });
    const together = await wordsOf();
    fixture.store.patch({ document: captions([[greeting[0]!], [greeting[1]!]]) });
    const apart = await wordsOf();

    expect(together.captions).toBe('segment:c1 0-1 sheet:main A: Hello(word:w1 #emphasis styled) world(word:w2 suggested:🔥)');
    expect(apart.captions).toBe('segment:c1 0-0.5 sheet:main A: Hello(word:w1 #emphasis suggested:👋 styled)\nsegment:c2 0.5-1 sheet:main: world(word:w2 suggested:🔥)');
  });

  it('answers every segment in order, timed, with its sheet, text and words', async () => {
    const result = await new ReadOperationsFixture().getTranscript().run({ detail: 'timed' });

    expect(result.ok).toBe(true);
    expect((result.output as { segments: unknown }).segments).toEqual([
      {
        ref: 'segment:s1',
        startSec: 0,
        endSec: 1,
        sheet: 'sheet:main',
        speaker: 'A',
        text: 'Hello world',
        words: [
          ['word:w1', 'Hello', 0, 0.5, { tags: ['emphasis'], styled: true }],
          ['word:w2', 'world', 0.5, 1, { suggestedEmoji: '🔥' }],
        ],
      },
      {
        ref: 'segment:s2',
        startSec: 2,
        endSec: 3,
        sheet: 'sheet:main',
        styled: true,
        text: 'second line',
        words: [['word:w3', 'second', 2, 2.5], ['word:w4', 'line', 2.5, 3]],
      },
      {
        ref: 'segment:s3',
        startSec: 10,
        endSec: 11,
        sheet: 'sheet:second',
        cut: true,
        text: 'Bye now',
        words: [['word:w5', 'Bye', 10, 10.5], ['word:w6', 'now', 10.5, 11]],
      },
    ]);
    expect(result.problems).toEqual([]);
  });

  it('answers one line per segment with every word\'s ref and marks beside it', async () => {
    const result = await new ReadOperationsFixture().getTranscript().run({});

    expect(result.output).toEqual({
      captions: [
        'segment:s1 0-1 sheet:main A: Hello(word:w1 #emphasis styled) world(word:w2 suggested:🔥)',
        'segment:s2 2-3 sheet:main styled: second(word:w3) line(word:w4)',
        'segment:s3 10-11 sheet:second cut: Bye(word:w5) now(word:w6)',
      ].join('\n'),
    });
  });

  it('answers only the segments overlapping the stretch asked', async () => {
    const result = await new ReadOperationsFixture().getTranscript().run({ fromSec: 1.5, toSec: 9 });

    expect(result.output).toEqual({ captions: 'segment:s2 2-3 sheet:main styled: second(word:w3) line(word:w4)' });
  });

  it('reads at most a minute of captions, and says where the next minute starts', async () => {
    const fixture = new ReadOperationsFixture();
    const segments = Array.from({ length: 30 }, (_, index) => new Segment({
      id: `s${index}`,
      lines: [new Line({ words: [new Word({ id: `w${index}`, text: `w${index}`, time: new TimeFragment(index * 5, index * 5 + 4) })] })],
    }));
    fixture.store.patch({ document: new Document({ sections: [new Section({ kind: 'main', segments })] }) });

    const first = await fixture.getTranscript().run({ toSec: 150 });
    const next = (first.output as { nextFromSec: number }).nextFromSec;
    const second = await fixture.getTranscript().run({ fromSec: next, toSec: 150 });

    expect((first.output as { captions: string }).captions.split('\n')).toHaveLength(12);
    expect(next).toBe(60);
    expect((second.output as { captions: string }).captions.startsWith('segment:s12 ')).toBe(true);
    expect((second.output as { nextFromSec: number }).nextFromSec).toBe(120);
  });

  it('says nothing of a next minute when nothing is left', async () => {
    const result = await new ReadOperationsFixture().getTranscript().run({});

    expect(result.output).not.toHaveProperty('nextFromSec');
  });

  it('reads the whole video as text, a line about every ten seconds, with no refs', async () => {
    const fixture = new ReadOperationsFixture();
    const words = Array.from({ length: 30 }, (_, index) => new Word({ text: `w${index}`, time: new TimeFragment(index, index + 0.9) }));
    fixture.store.patch({ document: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ lines: [new Line({ words })] })] })] }) });

    const result = await fixture.getTranscript().run({ detail: 'text' });

    expect((result.output as { text: string }).text.split('\n')).toEqual([
      '[0 s] w0 w1 w2 w3 w4 w5 w6 w7 w8 w9',
      '[10 s] w10 w11 w12 w13 w14 w15 w16 w17 w18 w19',
      '[20 s] w20 w21 w22 w23 w24 w25 w26 w27 w28 w29',
    ]);
  });

  it('reads the same text however the captions are split', async () => {
    const fixture = new ReadOperationsFixture();
    const before = await fixture.getTranscript().run({ detail: 'text' });
    const words = fixture.store.snapshot().document!.sections.flatMap((section) => section.segments.flatMap((segment) => segment.getWords()));
    fixture.store.patch({
      document: new Document({ sections: [new Section({ kind: 'main', segments: words.map((word) => new Segment({ lines: [new Line({ words: [word] })] })) })] }),
    });

    const after = await fixture.getTranscript().run({ detail: 'text' });

    expect(after.output).toEqual(before.output);
  });

  it('refuses a range that ends before it starts, changing nothing', async () => {
    const fixture = new ReadOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await fixture.getTranscript().run({ fromSec: 5, toSec: 2 });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('refuses a negative time', async () => {
    const result = await new ReadOperationsFixture().getTranscript().run({ fromSec: -1 });

    expect(result.ok).toBe(false);
  });

  it('changes nothing in the project', async () => {
    const fixture = new ReadOperationsFixture();
    const before = fixture.store.snapshot();

    await fixture.getTranscript().run({});

    expect(fixture.store.snapshot()).toBe(before);
  });
});
