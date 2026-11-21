/**
 * The family a shipped graphic preset belongs to, which the presets panel
 * lists it under. One a user saved belongs to none: it is listed under
 * what they saved.
 */
export type GraphicPresetCategory = 'hooks' | 'text' | 'speakers' | 'social' | 'info';

/**
 * The families in the order the presets panel lists them, with what each
 * is called there. Key order is the display order: the order they come up
 * in a video, the hook first, then text set over the picture anywhere in it.
 */
export const GRAPHIC_PRESET_CATEGORIES: Readonly<Record<GraphicPresetCategory, { readonly label: string }>> = {
  hooks: { label: 'Hooks' },
  text: { label: 'Text' },
  speakers: { label: 'Speakers' },
  social: { label: 'Social' },
  info: { label: 'Info' },
};

export const GRAPHIC_PRESET_CATEGORY_NAMES = Object.keys(GRAPHIC_PRESET_CATEGORIES) as GraphicPresetCategory[];
