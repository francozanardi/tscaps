import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';

/**
 * `TemplateRepository` decorator that hides templates whose rendering
 * depends on person segmentation when the current session cannot
 * preview them (native surface or proxy pipeline disabled). Both
 * `getAll()` and `getById(id)` filter — `getById` returning `null`
 * for an incompatible template lets the reference-resolver's
 * fallback path substitute the default template and notify the user,
 * matching the flow used for templates the catalog no longer carries.
 */
export class BehindActorPreviewCompatibleTemplateRepository implements TemplateRepository {

  constructor(
    private readonly inner: TemplateRepository,
    private readonly supportChecker: BehindActorPreviewSupportChecker,
  ) {}

  async getAll(): Promise<Template[]> {
    const all = await this.inner.getAll();
    if (this.supportChecker.isSupported()) return all;
    return all.filter((template) => !template.rendering.behindActor.required);
  }

  async getById(id: string): Promise<Template | null> {
    const template = await this.inner.getById(id);
    if (template === null) return null;
    if (!template.rendering.behindActor.required) return template;
    if (this.supportChecker.isSupported()) return template;
    return null;
  }
}
