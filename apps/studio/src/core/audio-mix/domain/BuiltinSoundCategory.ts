/** The groups the bundled sounds are offered in, in the order they are offered. */
export const BUILTIN_SOUND_CATEGORIES = ['whoosh', 'pop', 'ding', 'click', 'typing', 'writing', 'riser', 'impact', 'glitch'] as const;

/** What kind of sound a bundled sound is. */
export type BuiltinSoundCategory = (typeof BUILTIN_SOUND_CATEGORIES)[number];
