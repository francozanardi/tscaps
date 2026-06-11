import type { Template } from '@core/templates/domain/Template';

/** Maximum number of saved templates a user can hold at once. */
export const MAX_USER_TEMPLATES = 100;

/**
 * A `Template` the user saved off a customised sheet, paired with the
 * lifecycle metadata that distinguishes a saved entry from a built-in
 * one. The embedded template carries its own id (under
 * `template.metadata.id`) — that is the identity of the entry.
 */
export interface UserTemplate {
  readonly template: Template;

  /**
   * Id of the builtin template this was forked from, for display only ("Based on X").
   * Never load the parent at resolve time — the embedded template is self-contained.
   * The parent may have been edited, renamed, or removed since.
   */
  readonly parentTemplateId: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}
