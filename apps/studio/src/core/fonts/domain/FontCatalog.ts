import type { SelectOption } from '@core/templates/domain/definition/ControlField';

// Bundled fonts available to every template. Sourced from `@fontsource(-variable)/*`
// packages (preferred) or `src/styles/fonts/` (loaded by `fonts.css`) for families
// not on Fontsource. Adding a font here makes it pickable in every template's
// font-family universal control.
//
// Order is by expected usage frequency, not alphabetical: the families most
// content creators reach for first sit at the top so they're discoverable
// without scrolling. Less common but still curated families follow, grouped
// loosely by visual style (display, serif, script, mono).
//
// Variable packages register their family with a "<Name> Variable" suffix
// (e.g. 'Inter Variable'); the picker label hides that detail by stripping it
// for display, while the stored value and CSS-emitted string keep the actual
// loaded family name so templates resolve to a real `@font-face`.
//
// `cssValue` wraps the family in single quotes — required for names containing
// tokens that aren't valid CSS identifiers (e.g. 'Press Start 2P' where '2P'
// starts with a digit). Without quoting, the entire font-family declaration
// becomes invalid and the browser silently falls back.
const fontOption = (family: string): SelectOption => ({
  value: family,
  label: family.replace(/\s+Variable$/, ''),
  cssValue: `'${family}'`,
});

export const FONT_CATALOG: readonly SelectOption[] = [
  // Top picks — the families most caption work starts from
  fontOption('Inter Variable'),
  fontOption('Poppins'),
  fontOption('Montserrat Variable'),
  fontOption('Roboto'),
  fontOption('Anton'),
  fontOption('Bebas Neue'),
  fontOption('Bangers'),
  fontOption('Komika Axis'),
  // Modern sans
  fontOption('Manrope Variable'),
  fontOption('Nunito Variable'),
  fontOption('Raleway Variable'),
  fontOption('DM Sans Variable'),
  fontOption('Comfortaa Variable'),
  fontOption('Bricolage Grotesque Variable'),
  // Display / heavy
  fontOption('Oswald Variable'),
  fontOption('Bungee'),
  fontOption('Righteous'),
  // Serif
  fontOption('Playfair Display Variable'),
  fontOption('EB Garamond Variable'),
  fontOption('DM Serif Display'),
  fontOption('Fraunces Variable'),
  fontOption('Lora Variable'),
  // Script / cursive
  fontOption('Dancing Script Variable'),
  fontOption('Pacifico'),
  fontOption('Lobster'),
  fontOption('Caveat Variable'),
  fontOption('Permanent Marker'),
  // Mono / pixel
  fontOption('JetBrains Mono Variable'),
  fontOption('VT323'),
  fontOption('Press Start 2P'),
];
