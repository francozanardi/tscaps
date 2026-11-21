import type { RenderTimeMap } from '@tscaps/engine';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotTransition } from '@core/shots/domain/ShotTransition';
import { OUTPUT_TIME_TOLERANCE_SEC } from '@core/cuts/domain/OutputTimeTolerance';

/** A transition that plays: the shot whose transition it is, what it does, and the cut it plays over, in output time. */
export interface PlayedShotTransition {
  readonly shotId: string;
  readonly transition: ShotTransition;
  readonly cutSec: number;
}

/**
 * Which transitions between shots play, and over which cut of the
 * output, once the cuts collapse: the one place the picture and the
 * sounds read it from, so they cannot disagree.
 *
 * A transition plays over the cut where its shot opens on the output.
 * Where shots between two others are cut away whole, their starts land
 * on one cut, and the first of them that has a transition plays there:
 * the picture passes from the shot before the cut away ones straight to
 * the one after, with one transition. The others at that cut do not
 * play. A cut at the output's very start has nothing to pass from, so
 * nothing plays there.
 *
 * A transition never shortens to fit a shot: it runs its whole length
 * over whatever plays around its cut, a shot cut short or the next ones.
 */
export class ShotTransitionCuts {
  /** The transitions of `shots` that play, in order, with the cut each plays over. */
  played(shots: ShotPartition, timeMap: RenderTimeMap): PlayedShotTransition[] {
    const played: PlayedShotTransition[] = [];
    let cutSec = 0;
    let taken = true;
    for (const shot of shots.list().slice(1)) {
      const opensAtSec = timeMap.toOutputTime(shot.startSec);
      if (opensAtSec - cutSec > OUTPUT_TIME_TOLERANCE_SEC) {
        cutSec = opensAtSec;
        taken = false;
      }
      if (taken || shot.transition === undefined) continue;
      played.push({ shotId: shot.id, transition: shot.transition, cutSec });
      taken = true;
    }
    return played;
  }
}
