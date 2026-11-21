import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { SheetTemplateSaver } from '@core/editor-operations/services/SheetTemplateSaver';

const PARAMS = z.object({ name: z.string().trim().min(1), sheet: z.string().min(1).optional() });

/**
 * `save_template`: saves a caption style sheet's look as a template of the
 * person's own, listed with their saved templates for any project, and
 * switches the sheet to it (that switch is a checkpoint of its own; the
 * saved template is not undone). Answers the template, and why the sheet
 * was not switched when it was not.
 */
export class SaveTemplateMethod implements AutomationMethod {
  readonly name = 'save_template';

  constructor(
    private readonly saver: SheetTemplateSaver,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { name, sheet } = this.params.read(this.name, PARAMS, params);
    const saved = await this.saver.saveAs(name, sheet, { key: `automation:${crypto.randomUUID()}`, author: 'assistant' });
    if (!saved.ok) throw new AutomationCallFailedError(this.name, saved.problem);
    return { template: saved.template.id, name: saved.template.name, ...(saved.switchProblem === null ? {} : { notSwitched: saved.switchProblem }) };
  }
}
