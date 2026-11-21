import { z } from 'zod';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { HelpAnswers } from '@core/help/services/HelpAnswers';

const PARAMS = z.union([
  z.object({ article: z.string().trim().min(1) }),
  z.object({ query: z.string().trim().min(1) }),
]);

/**
 * `search_help`: the editor's help, by keyword search (the best matching
 * sections, each under its article id) or one article whole by id.
 * Answers the text and whether it found what was asked.
 */
export class SearchHelpMethod implements AutomationMethod {
  readonly name = 'search_help';

  constructor(
    private readonly answers: HelpAnswers,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const asked = this.params.read(this.name, PARAMS, params);
    return 'article' in asked ? this.answers.article(asked.article) : this.answers.search(asked.query);
  }
}
