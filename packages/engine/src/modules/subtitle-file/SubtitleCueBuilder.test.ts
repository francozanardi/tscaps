import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import { Line } from '@modules/document/Line';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';
import { SubtitleCueBuilder } from '@modules/subtitle-file/SubtitleCueBuilder';

const builder = new SubtitleCueBuilder();

function word(text: string, start: number, end: number, displayText?: string): Word {
  return new Word({
    text,
    time: new TimeFragment(start, end),
    ...(displayText === undefined ? {} : { displayText }),
  });
}

function segment(...words: Word[]): Segment {
  return new Segment({ lines: [new Line({ words })] });
}

function documentOf(...segments: Segment[]): Document {
  return new Document({ sections: [new Section({ segments, kind: '' })] });
}

describe('SubtitleCueBuilder', () => {

  it('gives each segment one cue spanning its words', () => {
    const cues = builder.build(documentOf(segment(word('hello', 1, 2), word('there', 2, 3))), []);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.time.start).toBe(1);
    expect(cues[0]!.time.end).toBe(3);
    expect(cues[0]!.rows.map((row) => row.text())).toEqual(['hello there']);
  });

  it('turns each line into its own row', () => {
    const cues = builder.build(documentOf(new Segment({
      lines: [new Line({ words: [word('top', 0, 1)] }), new Line({ words: [word('bottom', 1, 2)] })],
    })), []);
    expect(cues[0]!.rows.map((row) => row.text())).toEqual(['top', 'bottom']);
  });

  it('keeps a window per word inside the cue', () => {
    const cues = builder.build(documentOf(segment(word('hello', 1, 2), word('there', 2, 3))), []);
    expect(cues[0]!.tokens().map((token) => [token.time.start, token.time.end]))
      .toEqual([[1, 2], [2, 3]]);
  });

  it('leaves a hidden segment out of the file', () => {
    const hidden = segment(word('sure', 2, 2.05)).with({ hidden: true });
    const cues = builder.build(documentOf(segment(word('hello', 1, 2)), hidden), []);
    expect(cues.map((cue) => cue.rows.map((row) => row.text()))).toEqual([['hello']]);
  });

  // A segment held on screen past its narration must stay on screen for
  // as long in the file, so the explicit window wins over the words'.
  it('prefers an explicit segment window over the span of its words', () => {
    const held = new Segment({
      lines: [new Line({ words: [word('held', 1, 2)] })],
      customTime: new TimeFragment(1, 5),
    });
    expect(builder.build(documentOf(held), [])[0]!.time.end).toBe(5);
  });

  it('orders cues by time even when the document does not', () => {
    const later = segment(word('later', 10, 11));
    const earlier = segment(word('earlier', 1, 2));
    const cues = builder.build(documentOf(later, earlier), []);
    expect(cues.map((cue) => cue.rows[0]!.text())).toEqual(['earlier', 'later']);
  });

  it('skips words with no text and segments left with nothing to show', () => {
    const partial = segment(word('kept', 1, 2), word('', 2, 3));
    const blank = segment(word('', 4, 5));
    const cues = builder.build(documentOf(partial, blank), []);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.rows[0]!.text()).toBe('kept');
  });

  it('drops a segment whose window is empty', () => {
    expect(builder.build(documentOf(segment(word('instant', 3, 3))), [])).toEqual([]);
  });

  // Styling passes rewrite `displayText` to change how a caption looks
  // on screen. A file read back as content must not inherit that look.
  it('takes the transcript text, not the styled rendering', () => {
    const cues = builder.build(documentOf(segment(word('Hello.', 0, 1, 'hello'))), []);
    expect(cues[0]!.rows[0]!.text()).toBe('Hello.');
  });

  describe('with excluded windows', () => {

    it('pulls a cue earlier by the excluded time before it', () => {
      const cues = builder.build(documentOf(segment(word('after', 10, 12))), [{ startSec: 2, endSec: 5 }]);
      expect(cues[0]!.time.start).toBe(7);
      expect(cues[0]!.time.end).toBe(9);
    });

    // Word-timed formats read the tokens, so leaving them on the source
    // timeline would desynchronise inside an otherwise correct cue.
    it('rebases the words inside the cue too', () => {
      const cues = builder.build(
        documentOf(segment(word('one', 10, 11), word('two', 11, 12))),
        [{ startSec: 2, endSec: 5 }],
      );
      expect(cues[0]!.tokens().map((token) => [token.time.start, token.time.end]))
        .toEqual([[7, 8], [8, 9]]);
    });

    it('shortens a cue that spans an excluded window', () => {
      const held = new Segment({
        lines: [new Line({ words: [word('held', 1, 2)] })],
        customTime: new TimeFragment(1, 9),
      });
      const cues = builder.build(documentOf(held), [{ startSec: 3, endSec: 6 }]);
      expect(cues[0]!.time.start).toBe(1);
      expect(cues[0]!.time.end).toBe(6);
    });

    it('drops a cue that falls entirely inside an excluded window', () => {
      expect(builder.build(documentOf(segment(word('gone', 4, 5))), [{ startSec: 3, endSec: 6 }]))
        .toEqual([]);
    });
  });
});
