/** CSS generic families that deliberately leave the concrete face to the device. */
export const SYSTEM_FONT_FAMILIES = ['sans-serif', 'serif', 'monospace'] as const;

export type SystemFontFamily = (typeof SYSTEM_FONT_FAMILIES)[number];

export const DEFAULT_OTHER_FONT_FAMILY: SystemFontFamily = 'sans-serif';
