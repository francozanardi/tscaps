import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotTransition } from '@core/shots/domain/ShotTransition';

/** One word as a shot holds it, cut short by the boundary where the shot cuts through it. */
export interface ShotWordPiece {
  /** The id of the word it is a piece of: both halves of a word a boundary cuts through share it. */
  readonly wordId: string;
  readonly text: string;
  /** Source time the word opens at, which is where splitting before it would land. */
  readonly startSec: number;
  /** Source time the whole word closes at, wherever the shot ends. */
  readonly endSec: number;
}

/**
 * A shot with the extent and the words it turns out to hold, read off
 * the document of the moment.
 *
 * Nothing here is stored: the partition holds openings, and everything
 * else is a reading of them against whatever the transcript says now.
 */
export interface ResolvedShot {
  readonly id: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly pieces: ReadonlyArray<ShotWordPiece>;
  readonly layers: ReadonlyArray<ShotLayer>;
  /** The layers an earlier shot holds that still show on this one, bottom to top. */
  readonly continuingLayers: ReadonlyArray<ShotLayer>;
  /** How the picture passes into it from the shot before; absent for a plain cut. */
  readonly transition?: ShotTransition;
}
