import type { Template } from '@core/templates/domain/Template';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { ModeActivityChecker } from '@core/caption-modes/services/ModeActivityChecker';

/**
 * `TemplateRepository` decorator that leaves out of `getAll()` every
 * template whose modes would take no word of the open document: on a
 * transcript none of whose words a mode picks (no hook and no peak, say),
 * such a template would offer only its plainest captions. A template
 * without modes is never left out. `getById` is not filtered, so a
 * project that already uses one still opens with it.
 */
export class ModeActiveTemplateRepository implements TemplateRepository {
  constructor(
    private readonly inner: TemplateRepository,
    private readonly activityChecker: ModeActivityChecker,
  ) {}

  async getAll(): Promise<Template[]> {
    const all = await this.inner.getAll();
    return all.filter((template) => this.activityChecker.isActive(template));
  }

  getById(id: string): Promise<Template | null> {
    return this.inner.getById(id);
  }
}
