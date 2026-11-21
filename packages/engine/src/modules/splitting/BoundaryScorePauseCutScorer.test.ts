import { describe, expect, it } from 'vitest';
import { BoundaryScorePauseCutScorer } from '@modules/splitting';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

/** Two words, the first carrying `score`, with `gap` seconds of silence between them. */
function pair(score: number | null, gap: number): Word[] {
  return [
    new Word({ text: 'one', time: new TimeFragment(0, 1), boundaryScore: score }),
    new Word({ text: 'two', time: new TimeFragment(1 + gap, 2 + gap) }),
  ];
}

const pauseBonus = { weight: 0.5, minPause: 0.2, maxPause: 1 };

describe('BoundaryScorePauseCutScorer', () => {

  it('rates a cut by the score of the word before it', () => {
    expect(new BoundaryScorePauseCutScorer(null).scoreCutBefore(pair(0.7, 3), 1)).toBe(0.7);
  });

  it('rates a cut with no score and no silence as unknown', () => {
    expect(new BoundaryScorePauseCutScorer(pauseBonus).scoreCutBefore(pair(null, 0.1), 1)).toBeNull();
  });

  it('grows the bonus with the silence, up to its weight', () => {
    const scorer = new BoundaryScorePauseCutScorer(pauseBonus);
    expect(scorer.scoreCutBefore(pair(null, 0.6), 1)).toBeCloseTo(0.25);
    expect(scorer.scoreCutBefore(pair(null, 1), 1)).toBeCloseTo(0.5);
    expect(scorer.scoreCutBefore(pair(null, 4), 1)).toBeCloseTo(0.5);
  });

  it('adds the bonus to the score', () => {
    expect(new BoundaryScorePauseCutScorer(pauseBonus).scoreCutBefore(pair(0.3, 0.6), 1)).toBeCloseTo(0.55);
  });

  it('rejects a maximum pause that does not exceed the minimum', () => {
    expect(() => new BoundaryScorePauseCutScorer({ weight: 0.5, minPause: 1, maxPause: 1 })).toThrow(RangeError);
  });
});
