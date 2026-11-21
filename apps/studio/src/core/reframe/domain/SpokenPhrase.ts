/**
 * A few words said in a row by one voice, up to the end of a sentence or
 * a pause, in seconds of the source video. `speaker` is the
 * transcription's label for the voice, null where it did not tell voices
 * apart.
 */
export interface SpokenPhrase {
  readonly speaker: string | null;
  readonly startSec: number;
  readonly text: string;
}

/** A word and when it starts, in seconds of the source video. */
export interface SpokenWordStart {
  readonly wordId: string;
  readonly startSec: number;
}
