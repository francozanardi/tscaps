import { describe, expect, it } from 'vitest';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteFacts } from '@core/review-notes/domain/ReviewNoteFacts';
import { ReviewNoteTextWriter } from '@core/review-notes/services/ReviewNoteTextWriter';

/** What a model reads of the person's notes: when, what, where, and what was under it then and is now. */

const writer = new ReviewNoteTextWriter();

function note(overrides: Partial<ReviewNote>): ReviewNote {
  return {
    id: 'n',
    number: 1,
    createdAt: new Date('2026-11-13T00:00:00Z'),
    sourceSec: 12.4,
    place: null,
    refs: [],
    quote: null,
    text: 'Make this bigger',
    status: 'sent',
    batchId: 'b',
    ...overrides,
  };
}

function facts(overrides: Partial<ReviewNoteFacts> & { note: ReviewNote }): ReviewNoteFacts {
  return { outputSec: 10.85, refs: [], pictured: false, aspectChanged: false, ...overrides };
}

describe('writing notes down', () => {
  it('says each note\'s number, its moment in the source and in the export, and what the person said', () => {
    const text = writer.write([facts({ note: note({}) })]);

    expect(text).toContain('1 review note from the person');
    expect(text).toContain('Note 1 · at 12.40 s (10.85 s into the export)');
    expect(text).toContain('"Make this bigger"');
    expect(text).toContain('On the moment, not on a place in the frame.');
  });

  it('says when a note\'s moment is cut out of the export now', () => {
    const text = writer.write([facts({ note: note({}), outputSec: null })]);

    expect(text).toContain('(cut out of the export now)');
  });

  it('says where a note points, how it was drawn, and which picture shows it', () => {
    const place = {
      at: { x: 0.8, y: 0.1 },
      frameAspect: 9 / 16,
      marks: [
        { kind: 'stroke' as const, points: [{ x: 0.7, y: 0.1 }, { x: 0.8, y: 0.12 }] },
        { kind: 'stroke' as const, points: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.1 }] },
      ],
    };

    const text = writer.write([facts({ note: note({ number: 4, place }), pictured: true })]);

    expect(text).toContain('Points at the top right of the frame (x 0.80, y 0.10), marked with 2 lines drawn by hand.');
    expect(text).toContain('The picture of 12.40 s shows it over the frame, numbered 4.');
  });

  it('says what was under a note with its words now, and which of it is gone', () => {
    const text = writer.write([facts({
      note: note({ quote: 'this costs only nine dollars' }),
      refs: [
        { name: 'word:w1', reading: { status: 'found', words: 'nine' } },
        { name: 'segment:s1', reading: { status: 'gone' } },
        { name: 'shot:a', reading: { status: 'found', words: null } },
      ],
    })]);

    expect(text).toContain('Under it when made: word:w1 "nine"; segment:s1 (gone now: the captions or shots changed since); shot:a');
    expect(text).toContain('Caption on screen when made: "this costs only nine dollars"');
  });

  it('warns that a place may point elsewhere once the frame\'s aspect changed', () => {
    const place = { at: { x: 0.5, y: 0.5 }, frameAspect: 9 / 16, marks: [] };

    const text = writer.write([facts({ note: note({ place }), aspectChanged: true })]);

    expect(text).toContain('Points at the centre of the frame (x 0.50, y 0.50).');
    expect(text).toContain('the place may no longer be over what was meant');
  });

  it('says once how the pictures differ from the export', () => {
    const text = writer.write([facts({ note: note({}) }), facts({ note: note({ number: 2 }) })], ['Drawn from the preview\'s reduced copy.']);

    expect(text).toContain('2 review notes from the person');
    expect(text.match(/About the pictures/g)).toHaveLength(1);
  });
});
