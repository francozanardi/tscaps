import type { FootageLayer, RenderTimeMap } from '@tscaps/engine';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotTransitionKind } from '@core/shots/domain/ShotTransition';
import type { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';

/** A transition to put on the stage: its box's id, what it does, and how it is timed against its box. */
export interface StagedShotTransition {
  readonly layerId: string;
  readonly kind: ShotTransitionKind;
  /** How long it takes in all, in seconds. */
  readonly durationSec: number;
  /** How much of its first half falls before the output's start, and is not played. */
  readonly clippedSec: number;
}

/** A transition as the engine plays it, and as the stage resolving how it is drawn holds it. */
export interface BuiltShotTransition {
  readonly footage: FootageLayer;
  readonly staged: StagedShotTransition;
}

const LAYER_ID_PREFIX = 'shot-transition:';

/**
 * Turns the transitions between shots into what draws them: one layer
 * of the frame as drawn beneath it (the engine's backdrop) over each
 * cut that has one, half its length before the cut in output time and
 * half after, cut short at either end of the output. It goes above
 * every shot layer, so it carries the b-roll on both sides of the cut
 * with it. The preview and the export both build their transitions
 * here, so they cannot disagree.
 *
 * Which transitions play, and over which cut, is
 * {@link ShotTransitionCuts}'s to say: where shots between two others
 * are cut away whole, one transition plays between the shots around
 * them.
 */
export class ShotTransitionLayerBuilder {
  constructor(private readonly cuts: ShotTransitionCuts) {}

  /** The transitions of `shots`, in order, on an output `outputEndSec` long, or of unknown length while null. */
  build(shots: ShotPartition, timeMap: RenderTimeMap, outputEndSec: number | null): BuiltShotTransition[] {
    const built: BuiltShotTransition[] = [];
    for (const { shotId, transition, cutSec } of this.cuts.played(shots, timeMap)) {
      const halfSec = transition.durationSec / 2;
      const startSec = Math.max(0, cutSec - halfSec);
      const endSec = outputEndSec === null ? cutSec + halfSec : Math.min(outputEndSec, cutSec + halfSec);
      if (endSec <= startSec) continue;
      const layerId = `${LAYER_ID_PREFIX}${shotId}`;
      built.push({
        footage: { id: layerId, source: { kind: 'backdrop' }, outputStartSec: startSec, outputEndSec: endSec, sourceStartSec: 0, sourcePassSec: Infinity },
        staged: { layerId, kind: transition.kind, durationSec: transition.durationSec, clippedSec: startSec - (cutSec - halfSec) },
      });
    }
    return built;
  }
}
