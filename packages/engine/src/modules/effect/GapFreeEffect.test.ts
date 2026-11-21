import { describe, expect, it } from 'vitest';
import { GapFreeEffect } from '@modules/effect/GapFreeEffect';
import { Document } from '@modules/document/Document';
import { Line } from '@modules/document/Line';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';

function segment(id: string, text: string, start: number, end: number, hidden = false): Segment {
  return new Segment({ id, hidden, lines: [new Line({ words: [new Word({ text, time: new TimeFragment(start, end) })] })] });
}

/** "one" from 0 to 1 s, "two" (hidden) from 1.2 to 2 s, "three" from 4 to 5 s. */
function document(): Document {
  return new Document({ sections: [new Section({ kind: 'main', segments: [
    segment('a', 'one', 0, 1),
    segment('b', 'two', 1.2, 2, true),
    segment('c', 'three', 4, 5),
  ] })] });
}

function shownUntil(result: Document, id: string): number | undefined {
  return result.getSegments().find((each) => each.id === id)?.effectTime?.end;
}

describe('GapFreeEffect', () => {
  it('holds a caption across the time a hidden one takes, up to its padding', () => {
    expect(shownUntil(new GapFreeEffect().apply(document()), 'a')).toBe(2);
  });

  it('never holds a caption past a stop', () => {
    expect(shownUntil(new GapFreeEffect(undefined, 1000, Infinity, [1.2]).apply(document()), 'a')).toBe(1.2);
  });

  it('ignores stops before the caption ends', () => {
    expect(shownUntil(new GapFreeEffect(undefined, 1000, Infinity, [0.5]).apply(document()), 'a')).toBe(2);
  });

  it('holds nothing when a stop falls right where the caption ends', () => {
    const result = new GapFreeEffect(undefined, 1000, Infinity, [1]).apply(document());

    expect(result.getSegments().find((each) => each.id === 'a')?.effectTime).toBeNull();
  });
});
