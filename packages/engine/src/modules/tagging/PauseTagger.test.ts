import { describe, expect, it } from 'vitest';
import { PauseTagger } from '@modules/tagging/PauseTagger';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import { StructureTag } from '@modules/tags/StructureTag';

function segmentSaid(text: string, start: number, end: number): Segment {
  return new Segment({ lines: [new Line({ words: [new Word({ text, time: new TimeFragment(start, end) })] })] });
}

function followsPause(segments: Segment[]): boolean[] {
  const tagged = new PauseTagger({ minGapSeconds: 1 }).tag(new Document({ sections: [new Section({ kind: '', segments })] }));
  return tagged.getSegments().map((segment) =>
    [...segment.structureTags].some((tag) => tag.name === StructureTag.SEGMENT_AFTER_PAUSE));
}

describe('PauseTagger', () => {
  it('marks a segment said after a long enough silence', () => {
    expect(followsPause([segmentSaid('hello', 0, 1), segmentSaid('again', 2.5, 3)])).toEqual([false, true]);
  });

  it('leaves a segment said right after the previous one alone', () => {
    expect(followsPause([segmentSaid('hello', 0, 1), segmentSaid('again', 1.5, 2)])).toEqual([false, false]);
  });

  it('measures the silence between words, not how long the previous segment stays on screen', () => {
    const held = segmentSaid('hello', 0, 1).with({ effectTime: new TimeFragment(0, 2.4) });
    expect(followsPause([held, segmentSaid('again', 2.5, 3)])).toEqual([false, true]);
  });
});
