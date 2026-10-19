/**
 * Every built-in template, in the order the app receives them. The
 * order decides two things: the **first entry is the default** every
 * new sheet and every fallback lands on, and within a family the order
 * here is the order the gallery lists them in. Grouping by family is
 * for whoever edits this list — the gallery groups by each template's
 * own `category`, not by position.
 */
export const BUILTIN_TEMPLATE_NAMES: readonly string[] = [
  // Modern
  'mira',
  'enzo',
  'sara',
  'nova',
  'selene',
  'rhea',
  'sol',
  'hugo',
  'noor',
  'cleo',
  // Key moments
  'ezra',
  'elio',
  'pastor',
  'milo',
  'levi',
  'luca',
  'luna',
  // Viral
  'loki',
  'pepper',
  'lewis',
  'naya',
  'tito',
  'juno',
  'freya',
  'remi',
  'ivo',
  'tala',
  'kai',
  'zara',
  // Classic
  'yuki',
  'theo',
  'otto',
  'vera',
  'ada',
  'anya',
  'kel',
  // Lab
  'pico',
  'lena',
  'lyra',
  'nyx',
  'iris',
];
