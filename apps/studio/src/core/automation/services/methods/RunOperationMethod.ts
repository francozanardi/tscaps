import { z } from 'zod';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';

const PARAMS = z.object({
  operation: z.string().min(1),
  input: z.unknown(),
  checkpoint: z.string().min(1).max(200).optional(),
});

/**
 * `run_operation`: runs one operation of the catalog as the editing
 * assistant. Its changes make one checkpoint the person can undo; calls
 * naming the same `checkpoint` key join one checkpoint, unless the
 * person changed something in between. Answers the operation's result
 * and the checkpoint key it used.
 */
export class RunOperationMethod implements AutomationMethod {
  readonly name = 'run_operation';

  constructor(
    private readonly runner: EditorOperationRunner,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { operation, input, checkpoint } = this.params.read(this.name, PARAMS, params);
    const key = checkpoint ?? `automation:${crypto.randomUUID()}`;
    const result = await this.runner.run(operation, input ?? {}, { key, author: 'assistant' });
    return { ...result, checkpoint: key };
  }
}
