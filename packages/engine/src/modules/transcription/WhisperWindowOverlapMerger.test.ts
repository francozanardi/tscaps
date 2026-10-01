import { describe, expect, it } from 'vitest';
import {
  WhisperWindowOverlapMerger,
  type OverlapMergingTokenizer,
  type TokenTimeSpan,
} from '@modules/transcription/WhisperWindowOverlapMerger';

const THE = 10;
const FULL_STOP = 11;

function tokenizer(): OverlapMergingTokenizer {
  const merging: OverlapMergingTokenizer = {
    findLongestCommonSequence: () => {
      throw new Error('the library merge must not run');
    },
  };
  new WhisperWindowOverlapMerger().install(merging);
  return merging;
}

/** One span per token, a fixed step apart from `startSec`. */
function spans(count: number, startSec: number, stepSec = 0.4): TokenTimeSpan[] {
  return Array.from({ length: count }, (_, index): TokenTimeSpan => [
    startSec + index * stepSec,
    startSec + (index + 1) * stepSec,
  ]);
}

describe('WhisperWindowOverlapMerger', () => {
  it('keeps every word of two sentences that only share common words seconds apart', () => {
    // "...and the mistakes out of the timeline." closes one window; "Now the
    // second part." opens the next after a pause. Aligned tail over head,
    // both "the" and the full stop line up — but nine seconds apart.
    const left = [20, 21, THE, 22, 23, THE, 24, FULL_STOP];
    const right = [30, THE, 31, FULL_STOP, 32];

    const [tokens, times] = tokenizer().findLongestCommonSequence(
      [left, right],
      [spans(left.length, 16.4), spans(right.length, 23.6)],
    );

    expect(tokens).toEqual([...left, ...right]);
    expect(times).toHaveLength(left.length + right.length);
  });

  it('keeps one copy of the words two windows heard at the same moment', () => {
    const left = [20, 21, 22, 23, 24, 25];
    const right = [22, 23, 24, 25, 26, 27];
    const leftTimes = spans(left.length, 40);
    // The second take of the shared words lands a little later, as it does.
    const rightTimes = spans(right.length, 40.8 + 0.2);

    const [tokens, times] = tokenizer().findLongestCommonSequence([left, right], [leftTimes, rightTimes]);

    expect(tokens).toEqual([20, 21, 22, 23, 24, 25, 26, 27]);
    expect(times).toHaveLength(tokens.length);
  });

  it('merges on the tokens alone when there are no timestamps', () => {
    const [tokens, times] = tokenizer().findLongestCommonSequence([
      [20, 21, 22, 23],
      [22, 23, 24],
    ]);

    expect(tokens).toEqual([20, 21, 22, 23, 24]);
    expect(times).toEqual([]);
  });

  it('picks the next window up after the last word it already has when they share nothing', () => {
    const left = [20, 21, 22];
    const right = [30, 31, 32, 33];
    const rightTimes: TokenTimeSpan[] = [[9, 9.4], [9.4, 9.8], [10.4, 10.8], [10.8, 11.2]];

    const [tokens] = tokenizer().findLongestCommonSequence([left, right], [spans(left.length, 9.6), rightTimes]);

    expect(tokens).toEqual([20, 21, 22, 32, 33]);
  });
});
