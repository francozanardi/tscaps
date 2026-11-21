import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import type { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';

/**
 * Opens a shot on a word: in the silence before it, where a proposed
 * shot would open there. Does nothing for a word the video does not say.
 * One undo step, like any split.
 */
export class SplitShotBeforeWordAction {
  constructor(
    private readonly store: EditorStore,
    private readonly openings: ShotWordOpeningResolver,
    private readonly split: SplitShotAction,
  ) {}

  execute(wordId: string): void {
    const sec = this.openings.openingBefore(this.store.snapshot(), wordId);
    if (sec !== null) this.split.execute(sec);
  }
}
