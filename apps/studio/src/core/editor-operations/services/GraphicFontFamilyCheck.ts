import type { CatalogFamily } from '@core/fonts/domain/FontFamilyCatalog';

// The first family a `font-family` declaration names: quoted, or bare up to the comma or the declaration's end.
const FIRST_FONT_FAMILY = /font-family\s*:\s*("[^"]*"|'[^']*'|[^,;}"'<>]+)/gi;
const VARIABLE_SUFFIX = /\s+Variable$/;
// The names CSS itself defines: generic families, which leave the face to the device, and global values.
const CSS_KEYWORDS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
  'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', 'inherit', 'initial', 'unset', 'revert', 'revert-layer',
]);
// A colour emoji font is the device's on purpose: no bundled face draws emoji.
const EMOJI_FONT = /emoji/i;

/**
 * Reads which fonts a graphic asks for that it will not get: the first
 * family of a `font-family` declaration (in a stylesheet or a `style`
 * attribute) that is neither one of the bundled families, by its name or
 * its name without ` Variable`, nor a name CSS defines, nor a colour
 * emoji font. Only the first counts: it is the one meant to draw, and
 * the rest are fallbacks. A list opening with `var(...)` is skipped,
 * since what it holds is not known until it runs.
 */
export class GraphicFontFamilyCheck {
  private readonly known: ReadonlySet<string>;

  constructor(catalog: ReadonlyArray<CatalogFamily>) {
    this.known = new Set(catalog.flatMap(({ family }) => [family, family.replace(VARIABLE_SUFFIX, '')].map((name) => name.toLowerCase())));
  }

  /** The families `text` opens a `font-family` with that no bundled face draws, once each, as written. */
  unknownFamilies(text: string): string[] {
    const unknown = new Set<string>();
    for (const declaration of text.matchAll(FIRST_FONT_FAMILY)) {
      const first = this.familyName(declaration[1]!);
      if (first !== null && !this.isAvailable(first)) unknown.add(first);
    }
    return [...unknown];
  }

  private familyName(written: string): string | null {
    const name = written.replace(/!important\s*$/i, '').trim().replace(/^['"]|['"]$/g, '').trim();
    return name === '' || name.startsWith('var(') ? null : name;
  }

  private isAvailable(family: string): boolean {
    const name = family.toLowerCase();
    return this.known.has(name) || CSS_KEYWORDS.has(name) || EMOJI_FONT.test(name);
  }
}
