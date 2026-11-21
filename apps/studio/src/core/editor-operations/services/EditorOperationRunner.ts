import type { HistoryGroup } from '@core/editor/domain/HistoryGroup';
import type { HistoryGrouping } from '@core/editor-operations/domain/HistoryGrouping';
import type { OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorOperationCatalog } from '@core/editor-operations/services/EditorOperationCatalog';

/**
 * Runs operations of the catalog by name, each one's changes joining the
 * checkpoint of the history group a caller names: every operation run under
 * one group is undone at once, unless the person changed something in
 * between (see `HistoryGrouping`).
 */
export class EditorOperationRunner {
  constructor(
    private readonly catalog: EditorOperationCatalog,
    private readonly history: HistoryGrouping,
  ) {}

  /**
   * Runs the operation `name` with `input`. An unknown name answers
   * `ok: false` with a problem that lists the names there are. Rejects
   * only when the operation itself does.
   */
  async run(name: string, input: unknown, historyGroup: HistoryGroup): Promise<OperationResult> {
    const operation = this.catalog.find(name);
    if (operation === null) {
      const known = this.catalog.list().map((each) => each.name).join(', ');
      return { ok: false, output: null, problems: [{ severity: 'error', message: `No operation is named ${name}. Known: ${known}.` }] };
    }
    if (operation.effect === 'read') return operation.run(input);
    return this.history.withHistoryGroup(historyGroup, () => operation.run(input));
  }
}
