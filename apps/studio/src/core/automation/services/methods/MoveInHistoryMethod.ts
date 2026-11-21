import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { EditorStore } from '@core/editor/store/EditorStore';

const PARAMS = z.object({
  to: z.union([z.literal('back'), z.literal('forward'), z.object({ checkpoint: z.string().min(1) })]),
});

/**
 * `move_in_history`: undo (`back`), redo (`forward`), or show the project
 * as it stood at one checkpoint, keeping every checkpoint, as the
 * editor's own history does. Answers the checkpoint shown after.
 */
export class MoveInHistoryMethod implements AutomationMethod {
  readonly name = 'move_in_history';

  constructor(
    private readonly store: EditorStore,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { to } = this.params.read(this.name, PARAMS, params);
    const moved = this.move(to);
    if (!moved) throw new AutomationCallFailedError(this.name, 'there is no checkpoint there');
    return { shown: this.store.history().headId };
  }

  private move(to: z.infer<typeof PARAMS>['to']): boolean {
    if (to === 'back') return this.store.undo();
    if (to === 'forward') return this.store.redo();
    return this.store.jumpToCheckpoint(to.checkpoint);
  }
}
