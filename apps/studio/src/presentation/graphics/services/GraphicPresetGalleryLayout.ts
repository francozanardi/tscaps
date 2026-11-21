import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import {
  GRAPHIC_PRESET_CATEGORIES,
  GRAPHIC_PRESET_CATEGORY_NAMES,
  type GraphicPresetCategory,
} from '@core/graphics/domain/GraphicPresetCategory';

/** A section of the presets panel: the ones the user saved, or a family of the ones shipped. */
export interface GraphicPresetGallerySection {
  readonly id: GraphicPresetCategory | 'saved';
  readonly label: string;
  readonly presets: ReadonlyArray<GraphicPreset>;
}

// The family that leads on the video's first shot, and closes the list on any other.
const OPENING_FAMILY: GraphicPresetCategory = 'hooks';

/**
 * Arranges the graphic presets for the presets panel: the ones the user
 * saved first, in the order given, then each family of the ones shipped;
 * the hooks lead on the video's first shot and come last on any other,
 * where a hook is rarely what is wanted.
 * A search is answered as one flat list, as the template gallery's is: a
 * reader who typed a name is no longer browsing families.
 */
export class GraphicPresetGalleryLayout {
  /**
   * Sections in display order, for a graphic on the video's first shot
   * (`opening`) or another; an empty one is left out. A preset without a
   * family counts as saved.
   */
  build(presets: ReadonlyArray<GraphicPreset>, opening: boolean): GraphicPresetGallerySection[] {
    const families = opening
      ? GRAPHIC_PRESET_CATEGORY_NAMES
      : [...GRAPHIC_PRESET_CATEGORY_NAMES.filter((category) => category !== OPENING_FAMILY), OPENING_FAMILY];
    const sections: GraphicPresetGallerySection[] = [
      { id: 'saved', label: 'Saved', presets: presets.filter((preset) => preset.category === null) },
      ...families.map((category) => ({
        id: category,
        label: GRAPHIC_PRESET_CATEGORIES[category].label,
        presets: presets.filter((preset) => preset.category === category),
      })),
    ];
    return sections.filter((section) => section.presets.length > 0);
  }

  /**
   * Every preset whose name or description holds `query`, ignoring case,
   * those whose name does first, each half in the order given. An empty
   * query finds nothing: the sections show instead.
   */
  search(presets: ReadonlyArray<GraphicPreset>, query: string): GraphicPreset[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [];
    const byName = presets.filter((preset) => preset.name.toLowerCase().includes(needle));
    const byDescription = presets.filter((preset) => !byName.includes(preset) && preset.description.toLowerCase().includes(needle));
    return [...byName, ...byDescription];
  }
}
