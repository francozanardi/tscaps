/** One token's `[start, end]` seconds; `end` is `null` for a window's last token. */
export type TokenTimeSpan = [number, number | null];

/**
 * Merges the token runs of consecutive windows that may hold two takes on
 * the same audio. Returns the merged tokens and, when timestamps were given,
 * their timestamps in step; otherwise an empty timestamp list.
 */
export type OverlapSequenceMerger = (
  sequences: number[][],
  tokenTimestampSequences?: TokenTimeSpan[][] | null,
) => [number[], TokenTimeSpan[]];

/** The part of a loaded Whisper tokenizer this class reaches into. */
export interface OverlapMergingTokenizer {
  findLongestCommonSequence: OverlapSequenceMerger;
}

interface Overlap {
  readonly leftStart: number;
  readonly leftStop: number;
  readonly rightStart: number;
  readonly rightStop: number;
}

/**
 * How much earlier than the left take a matching right token may start.
 * The library's own tolerance, kept as it is.
 */
const EARLIER_TOLERANCE_SEC = 0.1;
/**
 * How much later than the left take a matching right token may start. Two
 * windows' takes on the same word were measured up to ~0.3 s apart.
 */
const LATER_TOLERANCE_SEC = 1;

/**
 * Stops two windows' unrelated text from being merged as if it were the
 * same speech.
 *
 * When a window's last segment runs into the stretch the next window also
 * covers, the library holds that segment's tokens back and merges them with
 * the next window's first segment, keeping one copy of whatever the two
 * share. Whether they share anything is decided by aligning the two token
 * runs and counting equal tokens. A matching token from the right must not
 * start much *earlier* than its match on the left, but nothing bounds how
 * much *later* it may start.
 *
 * So two sentences with no speech in common, seconds apart, still match on
 * their common words — "the", a full stop — and the merge splices them at
 * that match, dropping everything between. A window that ends by a pause is
 * where this happens: its last segment and the next window's first one are
 * different sentences, and the words around the pause disappear.
 *
 * This replaces the merge with the same algorithm, bounded on both sides: a
 * token only counts as a match when both takes place it within a second.
 * Two runs with no such match keep all their words, which is the library's
 * own behaviour for runs that share nothing.
 */
export class WhisperWindowOverlapMerger {

  private readonly installed = new WeakSet<OverlapMergingTokenizer>();

  /** Replaces the tokenizer's merge in place. Installing twice on the same tokenizer is a no-op. */
  install(tokenizer: OverlapMergingTokenizer): void {
    if (this.installed.has(tokenizer)) return;
    this.installed.add(tokenizer);
    tokenizer.findLongestCommonSequence = (sequences, tokenTimestampSequences = null) =>
      this.merge(sequences, tokenTimestampSequences);
  }

  private merge(sequences: number[][], timestampSequences: TokenTimeSpan[][] | null): [number[], TokenTimeSpan[]] {
    const timed = Array.isArray(timestampSequences) && timestampSequences.length > 0;
    let left = sequences[0] ?? [];
    let leftTimes = timed ? timestampSequences[0] ?? [] : [];
    const merged: number[] = [];
    const mergedTimes: TokenTimeSpan[] = [];
    for (let index = 1; index < sequences.length; index++) {
      const right = sequences[index]!;
      const rightTimes = timed ? timestampSequences[index] ?? [] : [];
      const overlap = this.bestOverlap(left, leftTimes, right, rightTimes, timed);
      const leftMid = overlap ? Math.floor((overlap.leftStop + overlap.leftStart) / 2) : left.length;
      const rightMid = overlap
        ? Math.floor((overlap.rightStop + overlap.rightStart) / 2)
        : this.firstAfter(leftTimes, rightTimes, timed);
      merged.push(...left.slice(0, leftMid));
      mergedTimes.push(...leftTimes.slice(0, leftMid));
      left = right.slice(rightMid);
      leftTimes = rightTimes.slice(rightMid);
    }
    merged.push(...left);
    if (!timed) return [merged, []];
    mergedTimes.push(...leftTimes);
    return [merged, mergedTimes];
  }

  /**
   * The alignment of the left run's tail over the right run's head with the
   * densest share of matching tokens, or `null` when no alignment matches
   * more than one token.
   */
  private bestOverlap(
    left: number[],
    leftTimes: TokenTimeSpan[],
    right: number[],
    rightTimes: TokenTimeSpan[],
    timed: boolean,
  ): Overlap | null {
    let best: Overlap | null = null;
    let bestScore = 0;
    for (let shift = 1; shift < left.length + right.length; shift++) {
      const overlap: Overlap = {
        leftStart: Math.max(0, left.length - shift),
        leftStop: Math.min(left.length, left.length + right.length - shift),
        rightStart: Math.max(0, shift - left.length),
        rightStop: Math.min(right.length, shift),
      };
      const matches = this.matchesIn(overlap, left, leftTimes, right, rightTimes, timed);
      // The library's tie-break: a longer overlap wins between equal shares.
      const score = matches / shift + shift / 1e4;
      if (matches > 1 && score > bestScore) {
        bestScore = score;
        best = overlap;
      }
    }
    return best;
  }

  private matchesIn(
    overlap: Overlap,
    left: number[],
    leftTimes: TokenTimeSpan[],
    right: number[],
    rightTimes: TokenTimeSpan[],
    timed: boolean,
  ): number {
    let matches = 0;
    for (let offset = 0; offset < overlap.leftStop - overlap.leftStart; offset++) {
      const leftIndex = overlap.leftStart + offset;
      const rightIndex = overlap.rightStart + offset;
      if (left[leftIndex] !== right[rightIndex]) continue;
      if (timed && !this.sameMoment(leftTimes[leftIndex], rightTimes[rightIndex])) continue;
      matches++;
    }
    return matches;
  }

  private sameMoment(leftTime: TokenTimeSpan | undefined, rightTime: TokenTimeSpan | undefined): boolean {
    if (!leftTime || !rightTime) return false;
    const later = rightTime[0] - leftTime[0];
    return later >= -EARLIER_TOLERANCE_SEC && later <= LATER_TOLERANCE_SEC;
  }

  /**
   * Where the right run picks up when it shares nothing with the left: at
   * its first token that does not start before the left run's last one.
   * Without timestamps, nothing of the right run is dropped.
   */
  private firstAfter(leftTimes: TokenTimeSpan[], rightTimes: TokenTimeSpan[], timed: boolean): number {
    const lastLeft = leftTimes[leftTimes.length - 1];
    if (!timed || !lastLeft) return 0;
    const index = rightTimes.findIndex((time) => time[0] >= lastLeft[0]);
    return index === -1 ? rightTimes.length : index;
  }
}
