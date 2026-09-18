import type { FontScript } from '@core/fonts/domain/FontScript';

export interface CatalogFamily {
  readonly family: string;
  /**
   * Scripts this face is offered for, so each script's picker can list
   * what actually fits it. The face it was drawn for comes first.
   *
   * Offered, not merely covered: every family here carries Latin glyphs
   * through its package's Latin subset, but a Naskh face is not a Latin
   * face and listing it among them would be noise.
   */
  readonly draws: readonly FontScript[];
}

// Bundled fonts available to every template. Sourced from `@fontsource(-variable)/*`
// packages (preferred) or `src/styles/fonts/` (loaded by `fonts.css`) for families
// not on Fontsource. Adding a family here makes it pickable in the picker of every
// script it draws.
//
// Order inside each script is by expected usage frequency, not alphabetical: the
// families most content creators reach for first sit at the top so they're
// discoverable without scrolling. Less common but still curated families follow,
// grouped loosely by visual style (display, serif, script, mono).
//
// Variable packages register their family with a "<Name> Variable" suffix
// (e.g. 'Inter Variable'); the picker label hides that detail by stripping it
// for display, while the stored value and CSS-emitted string keep the actual
// loaded family name so templates resolve to a real `@font-face`.
//
// Which family draws what is read off the packages `fonts.css` imports rather
// than off the families' reputations: `scripts/check-language-coverage.ts` reports
// which of them declare a `unicode-range` for each script, and these lists are its
// answer. A family that grows coverage in a later release grows it here too.
//
// Arabic faces draw Urdu as well: Urdu is the Arabic script in another tradition,
// and a Naskh face sets it legibly. Nastaliq is not offered the other way round —
// its diagonal cascade is a very different rhythm, and reaching for it by accident
// on Arabic text is a mistake worth making impossible.
const LATIN = ['latin'] as const;
const LATIN_CYRILLIC = ['latin', 'cyrillic'] as const;
const LATIN_CYRILLIC_GREEK = ['latin', 'cyrillic', 'greek'] as const;
const LATIN_DEVANAGARI = ['latin', 'devanagari'] as const;
const ARABIC = ['arabic', 'urdu'] as const;
const HEBREW = ['hebrew'] as const;
const URDU = ['urdu'] as const;
const BENGALI = ['bengali'] as const;
const TELUGU = ['telugu'] as const;
const TAMIL = ['tamil'] as const;
const THAI = ['thai'] as const;

export const FONT_FAMILIES: readonly CatalogFamily[] = [
  // Top picks — the families most caption work starts from
  { family: 'Inter Variable', draws: LATIN_CYRILLIC_GREEK },
  { family: 'Poppins', draws: LATIN_DEVANAGARI },
  { family: 'Montserrat Variable', draws: LATIN_CYRILLIC },
  { family: 'Roboto', draws: LATIN_CYRILLIC_GREEK },
  { family: 'Anton', draws: LATIN },
  { family: 'Bebas Neue', draws: LATIN },
  { family: 'Bangers', draws: LATIN },
  { family: 'Komika Axis', draws: LATIN },
  // Modern sans
  { family: 'Manrope Variable', draws: LATIN_CYRILLIC_GREEK },
  { family: 'Nunito Variable', draws: LATIN_CYRILLIC },
  { family: 'Raleway Variable', draws: LATIN_CYRILLIC },
  { family: 'DM Sans Variable', draws: LATIN },
  { family: 'Comfortaa Variable', draws: LATIN_CYRILLIC_GREEK },
  { family: 'Gabarito Variable', draws: LATIN },
  { family: 'Bricolage Grotesque Variable', draws: LATIN },
  // Display / heavy
  { family: 'Oswald Variable', draws: LATIN_CYRILLIC },
  { family: 'Bungee', draws: LATIN },
  { family: 'Righteous', draws: LATIN },
  // Serif
  { family: 'Playfair Display Variable', draws: LATIN },
  { family: 'EB Garamond Variable', draws: LATIN_CYRILLIC_GREEK },
  { family: 'DM Serif Display', draws: LATIN },
  { family: 'IM Fell English', draws: LATIN },
  { family: 'Fraunces Variable', draws: LATIN },
  { family: 'Lora Variable', draws: LATIN_CYRILLIC },
  // Script / cursive
  { family: 'Kalam', draws: LATIN_DEVANAGARI },
  { family: 'Dancing Script Variable', draws: LATIN },
  { family: 'Pacifico', draws: LATIN },
  { family: 'Lobster', draws: LATIN_CYRILLIC },
  { family: 'Caveat Variable', draws: LATIN_CYRILLIC },
  { family: 'Permanent Marker', draws: LATIN },
  // Mono / pixel
  { family: 'JetBrains Mono Variable', draws: LATIN_CYRILLIC_GREEK },
  { family: 'VT323', draws: LATIN },
  { family: 'Press Start 2P', draws: LATIN_CYRILLIC_GREEK },

  // Arabic and Persian
  { family: 'Vazirmatn Variable', draws: ARABIC },
  { family: 'Cairo Variable', draws: ARABIC },
  { family: 'Noto Sans Arabic Variable', draws: ARABIC },
  { family: 'Noto Kufi Arabic Variable', draws: ARABIC },
  { family: 'Tajawal', draws: ARABIC },
  { family: 'Lalezar', draws: ARABIC },
  { family: 'Amiri', draws: ARABIC },

  // Hebrew
  { family: 'Heebo Variable', draws: HEBREW },
  { family: 'Assistant Variable', draws: HEBREW },
  { family: 'Rubik Variable', draws: HEBREW },

  // Urdu. Nastaliq cascades each word diagonally downwards instead of sitting
  // on a flat baseline, so it needs noticeably more line height than the rest
  // of the catalog — a template tuned for Latin may need its line spacing
  // raised before Urdu captions fit.
  { family: 'Noto Nastaliq Urdu', draws: URDU },

  // Indic and Thai
  { family: 'Noto Sans Bengali Variable', draws: BENGALI },
  { family: 'Noto Serif Bengali Variable', draws: BENGALI },
  { family: 'Noto Sans Telugu Variable', draws: TELUGU },
  { family: 'Noto Serif Telugu Variable', draws: TELUGU },
  { family: 'Noto Sans Tamil Variable', draws: TAMIL },
  { family: 'Noto Serif Tamil Variable', draws: TAMIL },
  { family: 'Noto Sans Thai Variable', draws: THAI },
  { family: 'Noto Serif Thai Variable', draws: THAI },
];
