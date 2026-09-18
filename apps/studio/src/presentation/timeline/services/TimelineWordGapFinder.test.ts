import { describe, expect, it } from 'vitest';
import { Line, Segment, TimeFragment, Word } from '@tscaps/engine';
import { TimelineWordGapFinder } from '@presentation/timeline/services/TimelineWordGapFinder';
import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

function makeExtent(words: Word[], segStart = 0, segEnd = 10): TimelineSceneExtent {
  const segment = new Segment({
    lines: [new Line({ words })],
    customTime: new TimeFragment(segStart, segEnd),
  });
  return {
    segment,
    startSec: segStart,
    endSec: segEnd,
  };
}

describe('TimelineWordGapFinder', () => {
  const finder = new TimelineWordGapFinder();

  it('returns empty array when there are no extents at all', () => {
    const gaps = finder.find([], 60);
    expect(gaps).toEqual([]);
  });

  it('returns empty array when extents carry no words', () => {
    const extent = makeExtent([], 0, 10);
    const gaps = finder.find([extent], 10);
    expect(gaps).toEqual([]);
  });

  it('finds gaps before, between, and after words', () => {
    const word1 = new Word({ text: 'hello', time: new TimeFragment(2, 4) });
    const word2 = new Word({ text: 'world', time: new TimeFragment(6, 8) });
    const extent = makeExtent([word1, word2], 0, 10);

    const gaps = finder.find([extent], 10);

    expect(gaps).toEqual([
      { startSec: 0, endSec: 2 },
      { startSec: 4, endSec: 6 },
      { startSec: 8, endSec: 10 },
    ]);
  });

  it('handles overlapping words without reporting spurious gaps', () => {
    const word1 = new Word({ text: 'first', time: new TimeFragment(2, 5) });
    const word2 = new Word({ text: 'overlap', time: new TimeFragment(4, 7) });
    const extent = makeExtent([word1, word2], 0, 10);

    const gaps = finder.find([extent], 10);

    expect(gaps).toEqual([
      { startSec: 0, endSec: 2 },
      { startSec: 7, endSec: 10 },
    ]);
  });
});
