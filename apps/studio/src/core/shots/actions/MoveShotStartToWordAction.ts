import type { EditorStore } from '@core/editor/store/EditorStore';
import type { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import type { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';

/**
 * Makes a shot open on a word — the gesture that hands a word to the
 * shot before or after — in the silence before it, where a proposed
 * shot would open there. Does nothing for a word the video does not
 * say. One undo step, like any move of a shot's start.
 */
export class MoveShotStartToWordAction {
  constructor(
    private readonly store: EditorStore,
    private readonly openings: ShotWordOpeningResolver,
    private readonly moveStart: MoveShotStartAction,
  ) {}

  execute(shotId: string, wordId: string): void {
    const sec = this.openings.openingBefore(this.store.snapshot(), wordId);
    if (sec !== null) this.moveStart.execute(shotId, sec);
  }
}
