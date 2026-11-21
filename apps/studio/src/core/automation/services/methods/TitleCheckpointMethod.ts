import { z } from 'zod';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { HistoryGroupTitling } from '@core/editor-operations/domain/HistoryGroupTitling';

const PARAMS = z.object({ checkpoint: z.string().min(1), title: z.string().min(1).max(80) });

/** `title_checkpoint`: names the checkpoint a key made, as the person reads it in the history. Answers whether it did. */
export class TitleCheckpointMethod implements AutomationMethod {
  readonly name = 'title_checkpoint';

  constructor(
    private readonly titling: HistoryGroupTitling,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { checkpoint, title } = this.params.read(this.name, PARAMS, params);
    return { titled: this.titling.titleHistoryGroup(checkpoint, title) };
  }
}
