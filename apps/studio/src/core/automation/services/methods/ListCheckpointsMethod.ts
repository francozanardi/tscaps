import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { EditorStore } from '@core/editor/store/EditorStore';

/** `list_checkpoints`: the edit history, oldest first, and which checkpoint the editor shows. */
export class ListCheckpointsMethod implements AutomationMethod {
  readonly name = 'list_checkpoints';

  constructor(private readonly store: EditorStore) {}

  async run(): Promise<unknown> {
    const history = this.store.history();
    return {
      shown: history.headId,
      checkpoints: history.checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        parent: checkpoint.parentId,
        title: checkpoint.title,
        author: checkpoint.author,
        key: checkpoint.groupKey,
      })),
    };
  }
}
