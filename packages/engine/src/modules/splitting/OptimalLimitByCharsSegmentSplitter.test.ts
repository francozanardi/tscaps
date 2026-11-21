import { describe, expect, it } from 'vitest';
import {
  GreedyLimitByCharsSegmentSplitter,
  BoundaryScorePauseCutScorer,
  OptimalLimitByCharsSegmentSplitter,
} from '@modules/splitting';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

/**
 * `scores` maps a word's index to the boundary score it carries;
 * `pausesAfter` maps it to the silence, in seconds, before the next word.
 * Words otherwise last 0.3 s and follow each other with no gap.
 */
function segmentOf(
  text: string,
  scores: Readonly<Record<number, number>>,
  pausesAfter: Readonly<Record<number, number>>,
): Segment {
  let cursor = 0;
  const words = text.split(' ').map((word, i) => {
    const time = new TimeFragment(cursor, cursor + 0.3);
    cursor += 0.3 + (pausesAfter[i] ?? 0);
    return new Word({ text: word, time, boundaryScore: scores[i] ?? null });
  });
  return new Segment({ lines: [new Line({ words })] });
}

const pauseBonus = { weight: 0.5, minPause: 0.2, maxPause: 1 };

function split(
  text: string,
  config: { maxChars: number; minChars: number; cutCost: number },
  options: { scores?: Readonly<Record<number, number>>; pausesAfter?: Readonly<Record<number, number>> } = {},
): string[] {
  const scorer = new BoundaryScorePauseCutScorer(pauseBonus);
  const splitter = new OptimalLimitByCharsSegmentSplitter(
    config,
    scorer,
    new GreedyLimitByCharsSegmentSplitter(config, scorer),
  );
  return splitter.split([segmentOf(text, options.scores ?? {}, options.pausesAfter ?? {})])
    .map((segment) => segment.getText());
}

describe('OptimalLimitByCharsSegmentSplitter', () => {
  const bounds = { maxChars: 16, minChars: 6, cutCost: 0.4 };

  it('takes the longest chunks first when no cut is rated', () => {
    expect(split('aaa bbb ccc ddd eee', bounds)).toEqual(['aaa bbb ccc', 'ddd eee']);
  });

  it('cuts at the best-rated cut among splits of the same length', () => {
    expect(split('aaa bbb ccc ddd eee', bounds, { scores: { 1: 0.9, 2: 0.2 } }))
      .toEqual(['aaa bbb', 'ccc ddd eee']);
  });

  // Cutting right at the pause would leave "lose" alone, under the
  // minimum, so the cut before it has to move for the pause to be used.
  it('moves earlier cuts so that a long pause can be one', () => {
    const text = 'it\'s a little disheartening to lose 30 subscribers in one day';
    expect(split(text, { maxChars: 18, minChars: 7, cutCost: 0.4 }, { pausesAfter: { 5: 1.4 } }))
      .toEqual(['it\'s a little', 'disheartening', 'to lose', '30 subscribers in', 'one day']);
  });

  it('adds a cut the bounds do not need only when it rates above the cut cost', () => {
    const pausesAfter = { 1: 1.5 };
    expect(split('aaaa bbbb cccc dddd', { maxChars: 20, minChars: 7, cutCost: 0.4 }, { pausesAfter }))
      .toEqual(['aaaa bbbb', 'cccc dddd']);
    expect(split('aaaa bbbb cccc dddd', { maxChars: 20, minChars: 7, cutCost: 0.6 }, { pausesAfter }))
      .toEqual(['aaaa bbbb cccc dddd']);
  });

  it('keeps a word longer than the maximum whole', () => {
    expect(split('a extraordinarily b', { maxChars: 5, minChars: 0, cutCost: 0.4 }))
      .toEqual(['a', 'extraordinarily', 'b']);
  });

  it('keeps a segment shorter than the minimum whole', () => {
    expect(split('hi', bounds)).toEqual(['hi']);
  });

  it('leaves a segment no split can bound to the fallback', () => {
    expect(split('hello world again', { maxChars: 12, minChars: 6, cutCost: 0.4 }))
      .toEqual(['hello world again']);
  });
});
