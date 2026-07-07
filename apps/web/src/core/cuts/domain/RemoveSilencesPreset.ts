/**
 * A named intensity level for the "remove silences" auto-cut feature.
 * Each preset maps to a pair of minimum-length thresholds — one for
 * pauses within a sentence (intra), one for pauses between sentences
 * (inter) — that decide which silences qualify for removal. Tighter
 * presets cut more silences and produce a snappier video; looser
 * presets preserve the natural rhythm of speech.
 */
export type RemoveSilencesPreset = 'faster' | 'fast' | 'natural';

export interface SilenceThresholds {
  readonly intraSentenceMinSec: number;
  readonly interSentenceMinSec: number;
}

/**
 * Threshold pairs per preset. The intra threshold is always less than
 * or equal to the inter threshold because pauses within a sentence are
 * almost always hesitation, while pauses between sentences are
 * legitimate narrative beats and deserve more room before being cut.
 */
export const REMOVE_SILENCES_PRESET_THRESHOLDS: Record<RemoveSilencesPreset, SilenceThresholds> = {
  faster:  { intraSentenceMinSec: 0.2, interSentenceMinSec: 0.4 },
  fast:    { intraSentenceMinSec: 0.4, interSentenceMinSec: 0.7 },
  natural: { intraSentenceMinSec: 0.6, interSentenceMinSec: 1.2 },
};

export const REMOVE_SILENCES_PRESETS: ReadonlyArray<RemoveSilencesPreset> = ['natural', 'fast', 'faster'];
