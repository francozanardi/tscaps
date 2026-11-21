/**
 * Family a built-in template belongs to. A template is in exactly one:
 * the gallery lists it once, and a look that could be argued into two
 * is filed where someone would go looking for it first.
 */
export type TemplateCategory = 'magazine' | 'modern' | 'viral' | 'classic' | 'lab';

/**
 * How the gallery shows a family. `clip` plays a burned-in sample over
 * the footage; `tile` renders the template's own DOM over a neutral
 * swatch.
 */
export type TemplateCategoryPreview = 'clip' | 'tile';

export interface TemplateCategoryDefinition {
  readonly label: string;
  /**
   * A family is `clip` when a caption on its own does not carry the
   * look — either it composes against the footage, or what it does
   * with the words is the point and a still frame misses it.
   */
  readonly preview: TemplateCategoryPreview;
  /** Rows the gallery shows before the family's *View all* link. */
  readonly previewRows: number;
}

/**
 * The families the gallery ships, in the order it lists them. Key order
 * is the display order, so moving a section is moving its entry.
 *
 * The two shown as clips lead, together: a family's preview is a whole
 * different object on the page, and a list that alternates between the
 * two kinds reads as several galleries stacked.
 *
 * `magazine` holds the looks where the type takes the frame over, the way
 * a magazine cover does: an oversized word spanning the width, a stack of
 * tall lines, letters blended with the footage or set behind the person.
 * They read as a page laid out over the shot, which is why a still tile
 * misses them. They caption a whole video like any other family; none of
 * them is reserved for one moment of it.
 */
export const TEMPLATE_CATEGORIES: Readonly<Record<TemplateCategory, TemplateCategoryDefinition>> = {
  modern: { label: 'Modern', preview: 'clip', previewRows: 3 },
  magazine: { label: 'Magazine', preview: 'clip', previewRows: 1 },
  viral: { label: 'Viral', preview: 'tile', previewRows: 2 },
  classic: { label: 'Classic', preview: 'tile', previewRows: 2 },
  lab: { label: 'Lab', preview: 'tile', previewRows: 2 },
};

export const TEMPLATE_CATEGORY_NAMES = Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[];
