import type { CutScorer } from '@modules/splitting/CutScorer';
import type { Word } from '@modules/document/Word';

/**
 * How much a silence between two words adds to the case for cutting
 * between them. The bonus grows linearly from nothing at `minPause` to
 * `weight` at `maxPause` and stays there for longer silences. Times are
 * in seconds; `maxPause` must exceed `minPause`.
 */
export interface PauseBonusConfig {
  /** Bonus a silence of `maxPause` or longer adds, on the same scale as `boundaryScore`. */
  weight: number;
  /** Silences up to this long add nothing: ordinary gaps between words and timing noise. */
  minPause: number;
  /** Silence at which the bonus reaches `weight`. */
  maxPause: number;
}

/**
 * Rates a cut by the `boundaryScore` of the word before it, plus a
 * bonus for the silence that follows that word when `pauseBonus` is
 * given. A null score is unknown rather than poor: it adds nothing, and
 * a cut with neither a score nor a silence past `minPause` rates null.
 */
export class BoundaryScorePauseCutScorer implements CutScorer {
  /** @throws RangeError when `pauseBonus.maxPause` does not exceed `pauseBonus.minPause`. */
  constructor(private readonly _pauseBonus: PauseBonusConfig | null) {
    if (_pauseBonus && !(_pauseBonus.maxPause > _pauseBonus.minPause)) {
      throw new RangeError(
        `pauseBonus.maxPause (${_pauseBonus.maxPause}) must exceed minPause (${_pauseBonus.minPause})`,
      );
    }
  }

  scoreCutBefore(words: readonly Word[], index: number): number | null {
    const boundaryScore = words[index - 1]!.boundaryScore;
    const pauseBonus = this.pauseBonus(words, index);
    if (boundaryScore === null && pauseBonus === 0) return null;
    return (boundaryScore ?? 0) + pauseBonus;
  }

  private pauseBonus(words: readonly Word[], index: number): number {
    const config = this._pauseBonus;
    const next = words[index];
    if (!config || !next) return 0;
    const gap = next.time.start - words[index - 1]!.time.end;
    const ramp = (gap - config.minPause) / (config.maxPause - config.minPause);
    return config.weight * Math.min(1, Math.max(0, ramp));
  }
}
