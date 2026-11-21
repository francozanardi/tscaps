import type { RemoveSilencesPreset } from '@core/cuts/domain/RemoveSilencesPreset';

/** The quiet a cut leaves next to the sound of the words it keeps, in seconds: after the word before it, and before the word after it. */
export interface CutAir {
  readonly afterWordSec: number;
  readonly beforeWordSec: number;
}

/**
 * How tight the assistant's cuts are: the air each keeps inside a
 * sentence and between sentences, and the least a cut must take out to
 * be worth the jump it makes in the picture.
 */
export interface CutPace {
  readonly withinSentence: CutAir;
  readonly betweenSentences: CutAir;
  readonly minCutSec: number;
}

// Natural leaves about a third of a second of pause inside a sentence and close to half a second between sentences;
// fast and faster leave less. More air follows a word than precedes the next: a word's tail and breath carry, a word's
// start needs little.
export const CUT_PACES: Readonly<Record<RemoveSilencesPreset, CutPace>> = {
  natural: {
    withinSentence: { afterWordSec: 0.18, beforeWordSec: 0.12 },
    betweenSentences: { afterWordSec: 0.27, beforeWordSec: 0.18 },
    minCutSec: 0.3,
  },
  fast: {
    withinSentence: { afterWordSec: 0.12, beforeWordSec: 0.08 },
    betweenSentences: { afterWordSec: 0.18, beforeWordSec: 0.12 },
    minCutSec: 0.2,
  },
  faster: {
    withinSentence: { afterWordSec: 0.07, beforeWordSec: 0.05 },
    betweenSentences: { afterWordSec: 0.11, beforeWordSec: 0.07 },
    minCutSec: 0.1,
  },
};
