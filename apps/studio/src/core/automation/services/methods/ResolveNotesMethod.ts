import { z } from 'zod';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { HistoryGrouping } from '@core/editor-operations/domain/HistoryGrouping';
import type { ResolveReviewNotesAction } from '@core/review-notes/actions/ResolveReviewNotesAction';

const PARAMS = z.object({
  notes: z.array(z.number().int().min(1)).min(1),
  checkpoint: z.string().min(1).optional(),
});

/**
 * `resolve_notes`: removes from the frame the person's notes the agent
 * did, as one step of the history (under `checkpoint`, the change's own,
 * when given), so undoing it brings them back. Answers, per number,
 * `resolved`, `unknown` (no note has it) or `not-sent` (a draft, left as
 * it is).
 */
export class ResolveNotesMethod implements AutomationMethod {
  readonly name = 'resolve_notes';

  constructor(
    private readonly history: HistoryGrouping,
    private readonly resolve: ResolveReviewNotesAction,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { notes, checkpoint } = this.params.read(this.name, PARAMS, params);
    const key = checkpoint ?? `automation:resolve:${crypto.randomUUID()}`;
    const results = await this.history.withHistoryGroup({ key, author: 'assistant' }, () => this.resolve.execute(notes));
    return { notes: notes.map((number, index) => ({ note: number, result: results[index] ?? 'unknown' })) };
  }
}
