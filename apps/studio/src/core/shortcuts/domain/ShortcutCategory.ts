/** The group a shortcut is listed under. Says nothing about where it fires. */
export type ShortcutCategory = 'general' | 'playback' | 'transcript' | 'timeline';

/** Every category, in the order they are listed. */
export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = ['general', 'playback', 'transcript', 'timeline'];
