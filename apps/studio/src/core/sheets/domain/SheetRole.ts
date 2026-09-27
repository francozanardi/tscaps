import type { UserFacingTagName } from '@core/tagging/domain/TagName';
import type { TemplateCategory } from '@core/templates/domain/TemplateCategory';

/**
 * Narrative role a sheet plays in the video's caption structure. A role
 * names what the sheet's content is for (the opening attention line,
 * the phrases the video is built around), not how it looks — styling
 * stays entirely in the sheet's template and controls. The union grows
 * as the platform adds roles.
 */
export type SheetRole = 'hook' | 'peak';

/**
 * Everything the platform knows about a role that is not its content:
 * the identity its sheet is created with, and where its look comes from.
 */
export interface SheetRoleDefinition {
  /**
   * Fixed id of the sheet holding this role. A role is unique per
   * project, so its sheet can be found by id and a second one can never
   * be created by accident.
   */
  readonly sheetId: string;
  readonly name: string;
  readonly color: string;
  /**
   * Pool a fallback template is drawn from when the preferred one is
   * absent. It steers nothing else: a role's sheet can end up on any
   * template the user picks.
   */
  readonly templateCategory: TemplateCategory;
  /**
   * Template the role is handed when the device can render it. Not every
   * template is available everywhere — capability filtering removes the
   * ones a browser gets wrong — so this is the wish, and the category
   * above is what answers when the wish is absent.
   */
  readonly preferredTemplateId: string;
  /**
   * Semantic tag whose words belong to this role. What marks the content
   * is the same thing that names it, and it is always a tag the user can
   * see and set — a role fed by an invisible mark would offer a sheet
   * nobody could explain.
   */
  readonly tagName: UserFacingTagName;
}

/**
 * The roles the platform ships. `hook` and `peak` share a template
 * category on purpose: both exist to make a phrase stand out, and want
 * the same loud, centred, structure-heavy looks. What separates them is
 * where in the video they sit — a hook only ever opens it.
 */
export const SHEET_ROLES: Readonly<Record<SheetRole, SheetRoleDefinition>> = {
  hook: {
    sheetId: 'hook',
    name: 'Hook',
    color: '#EBB85C',
    templateCategory: 'key-moments',
    preferredTemplateId: 'ezra',
    tagName: 'hook',
  },
  peak: {
    sheetId: 'peak',
    name: 'Peak',
    color: '#C56EE0',
    templateCategory: 'key-moments',
    preferredTemplateId: 'elio',
    tagName: 'peak',
  },
};

export const SHEET_ROLE_NAMES = Object.keys(SHEET_ROLES) as SheetRole[];
