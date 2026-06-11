import type { Word } from '@modules/document/Word';

/**
 * Per-speaker narration speed in chars-per-second, sampled from the
 * source words. `charsPerSecond` returns the speaker-specific rate when
 * known, the mean across speakers otherwise, and a conservative default
 * when the pace was never captured.
 */
export class NarrationPace {
  static readonly DEFAULT_CHARS_PER_SECOND = 15;

  private readonly _bySpeaker: ReadonlyMap<string, number>;
  private readonly _mean: number | null;

  constructor(bySpeaker: ReadonlyMap<string, number>) {
    this._bySpeaker = bySpeaker;
    let sum = 0;
    let count = 0;
    for (const value of bySpeaker.values()) {
      if (value > 0) {
        sum += value;
        count++;
      }
    }
    this._mean = count > 0 ? sum / count : null;
  }

  static empty(): NarrationPace {
    return new NarrationPace(new Map());
  }

  static fromWords(words: ReadonlyArray<Word>): NarrationPace {
    const totals = new Map<string, { chars: number; seconds: number }>();
    for (const word of words) {
      const duration = word.time.end - word.time.start;
      if (duration <= 0 || word.text.length === 0) continue;
      const key = word.speakerId ?? '';
      const acc = totals.get(key) ?? { chars: 0, seconds: 0 };
      acc.chars += word.text.length;
      acc.seconds += duration;
      totals.set(key, acc);
    }
    const rates = new Map<string, number>();
    for (const [key, { chars, seconds }] of totals) {
      rates.set(key, chars / seconds);
    }
    return new NarrationPace(rates);
  }

  charsPerSecond(speakerId: string | null): number {
    const direct = this._bySpeaker.get(speakerId ?? '');
    if (direct !== undefined && direct > 0) return direct;
    return this._mean ?? NarrationPace.DEFAULT_CHARS_PER_SECOND;
  }

  isEmpty(): boolean {
    return this._bySpeaker.size === 0;
  }

  toRecord(): Record<string, number> {
    return Object.fromEntries(this._bySpeaker);
  }

  static fromRecord(record: Record<string, number>): NarrationPace {
    return new NarrationPace(new Map(Object.entries(record)));
  }
}
