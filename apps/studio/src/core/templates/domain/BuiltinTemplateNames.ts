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
  'nova',
  'sol',
  'selene',
  'suki',
  'rhea',
  'sara',
  'hugo',
  'noor',
  'cleo',
  // Key moments
  'ezra',
  'elio',
  'pastor',
  'milo',
  'luca',
  'luna',
  'levi',
  // Viral
  'loki',
  'lewis',
  'pepper',
  'naya',
  'miso',
  'ren',
  'juno',
  'tito',
  'apollo',
  'ivo',
  'remi',
  'tala',
  'freya',
  // Classic
  'yuki',
  'theo',
  'vera',
  'otto',
  'dot',
  'pippa',
  'nina',
  'ada',
  'anya',
  'kel',
  // Lab
  'boba',
  'ziggy',
  'bean',
  'nyx',
  'pico',
  'iris',
  'lena',
  'lyra',
];
