import { describe, expect, it } from 'vitest';
import {
  GreedyLimitByCharsSegmentSplitter,
  BoundaryScorePauseCutScorer,
  type GreedyLimitByCharsConfig,
  type PauseBonusConfig,
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
  scores: Readonly<Record<number, number>> = {},
  pausesAfter: Readonly<Record<number, number>> = {},
): Segment {
  let cursor = 0;
  const words = text.split(' ').map((word, i) => {
    const time = new TimeFragment(cursor, cursor + 0.3);
    cursor += 0.3 + (pausesAfter[i] ?? 0);
    return new Word({ text: word, time, boundaryScore: scores[i] ?? null });
  });
  return new Segment({ lines: [new Line({ words })] });
}

function split(
  text: string,
  config: GreedyLimitByCharsConfig & { pauseBonus?: PauseBonusConfig },
  scores?: Readonly<Record<number, number>>,
  pausesAfter?: Readonly<Record<number, number>>,
): string[] {
  const splitter = new GreedyLimitByCharsSegmentSplitter(
    config,
    new BoundaryScorePauseCutScorer(config.pauseBonus ?? null),
  );
  return splitter.split([segmentOf(text, scores, pausesAfter)]).map((segment) => segment.getText());
}

const pauseBonus = { weight: 0.5, minPause: 0.2, maxPause: 1 };

describe('GreedyLimitByCharsSegmentSplitter', () => {

  it('cuts after the highest-scored word inside the valid range', () => {
    expect(split('aaa bbb ccc ddd eee', { maxChars: 16, minChars: 6 }, { 1: 0.9, 2: 0.2 }))
      .toEqual(['aaa bbb', 'ccc ddd eee']);
  });

  it('takes the longest valid chunk when no word in range carries a score', () => {
    expect(split('aaa bbb ccc ddd eee', { maxChars: 16, minChars: 6 }))
      .toEqual(['aaa bbb ccc', 'ddd eee']);
  });

  it('keeps a word longer than the maximum whole', () => {
    expect(split('extraordinary', { maxChars: 5, minChars: 0 })).toEqual(['extraordinary']);
  });

  // The two bounds cannot always both hold, and which one gives way
  // depends on which side of the cut is stuck.
  describe('when the bounds conflict', () => {

    // No cut inside the maximum reaches the minimum, so the chunk is
    // short. Growing it past the maximum is not on the table.
    it('gives up the minimum to hold the maximum', () => {
      expect(split('the extraordinary x', { maxChars: 16, minChars: 6 }))
        .toEqual(['the', 'extraordinary x']);
    });

    // Every cut inside the maximum would strand a tail under the
    // minimum, so the tail is absorbed and the chunk overruns.
    it('gives up the maximum rather than strand a tail under the minimum', () => {
      expect(split('hello world again', { maxChars: 12, minChars: 6 }))
        .toEqual(['hello world again']);
    });
  });

  describe('with a pause bonus', () => {
    const config = { maxChars: 16, minChars: 6, pauseBonus };

    it('cuts at a silence when no word carries a score', () => {
      expect(split('aaa bbb ccc ddd eee', config, {}, { 1: 0.6 }))
        .toEqual(['aaa bbb', 'ccc ddd eee']);
    });

    it('lets a long silence outweigh a weak score', () => {
      expect(split('aaa bbb ccc ddd eee', config, { 2: 0.3 }, { 1: 1.5 }))
        .toEqual(['aaa bbb', 'ccc ddd eee']);
    });

    it('keeps a strong score ahead of a capped silence', () => {
      expect(split('aaa bbb ccc ddd eee', config, { 2: 0.95 }, { 1: 3 }))
        .toEqual(['aaa bbb ccc', 'ddd eee']);
    });

    it('prefers the longer of two silences below the cap', () => {
      expect(split('aaa bbb ccc ddd eee', config, {}, { 1: 0.4, 2: 0.8 }))
        .toEqual(['aaa bbb ccc', 'ddd eee']);
    });

    it('sums a silence onto the score of the word before it', () => {
      expect(split('aaa bbb ccc ddd eee', config, { 1: 0.5, 2: 0.6 }, { 1: 0.6 }))
        .toEqual(['aaa bbb', 'ccc ddd eee']);
    });

    it('ignores silences shorter than the minimum', () => {
      expect(split('aaa bbb ccc ddd eee', config, {}, { 1: 0.15 }))
        .toEqual(['aaa bbb ccc', 'ddd eee']);
    });
  });

  it('ignores silences when no pause bonus is configured', () => {
    expect(split('aaa bbb ccc ddd eee', { maxChars: 16, minChars: 6 }, {}, { 1: 2 }))
      .toEqual(['aaa bbb ccc', 'ddd eee']);
  });
});
