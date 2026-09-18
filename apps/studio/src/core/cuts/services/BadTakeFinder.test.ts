import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, Tag, TimeFragment, Word } from '@tscaps/engine';
import { BadTakeFinder } from '@core/cuts/services/BadTakeFinder';

function word(text: string, start: number, end: number, cut = false): Word {
  return new Word({
    text,
    time: new TimeFragment(start, end),
    ...(cut ? { semanticTags: new Set([Tag.of('cut')]) } : {}),
  });
}

function documentOf(words: Word[]): Document {
  return new Document({
    sections: [new Section({ segments: [new Segment({ lines: [new Line({ words })] })], kind: 'main' })],
  });
}

describe('BadTakeFinder', () => {
  const finder = new BadTakeFinder();

  it('cuts a tagged run from its first word to its last', () => {
    const ranges = finder.find(documentOf([
      word('of', 16.6, 16.799),
      word('like', 16.879, 17.02, true),
      word('of,', 17.159, 17.3),
    ]), 20);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.startSec).toBeCloseTo(16.839, 3);
    expect(ranges[0]!.endSec).toBeCloseTo(17.0895, 3);
  });

  it('cuts nothing for a run the transcript could not place', () => {
    const ranges = finder.find(documentOf([
      word('way.', 14.379, 14.879),
      word('I', 15.38, 15.38, true),
      word('saw', 15.38, 15.38, true),
      word('...', 15.38, 15.9),
    ]), 20);
    expect(ranges).toEqual([]);
  });

  it('cuts a run that mixes placed and unplaced words, anchored on the placed one', () => {
    const ranges = finder.find(documentOf([
      word('way.', 14.379, 14.879),
      word('I', 15.38, 15.38, true),
      word('saw', 15.38, 15.9, true),
      word('them', 16.2, 16.5),
    ]), 20);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.startSec).toBeCloseTo(15.3, 3);
    expect(ranges[0]!.endSec).toBeCloseTo(15.98, 3);
  });
});
