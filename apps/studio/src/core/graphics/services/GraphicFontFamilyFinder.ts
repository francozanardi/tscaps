import type { CatalogFamily } from '@core/fonts/domain/FontFamilyCatalog';
import type { RenamedFontFamily } from '@core/fonts/services/FontFaceCssBuilder';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';

const VARIABLE_SUFFIX = /\s+Variable$/;

/**
 * Finds the bundled families a graphic names, anywhere in its CSS, HTML
 * or JavaScript: a `font-family` in a stylesheet or a `style` attribute,
 * and a canvas's `context.font` alike, so each can be handed to it.
 *
 * A family is found by its name, as CSS reads it (case aside), standing
 * on its own; a variable family also answers to its name without the
 * ` Variable` its package gives it (`Inter` for `Inter Variable`), and
 * is then declared under that shorter name. A name that happens to
 * appear in the graphic's text and not as a font is found too, which
 * costs that face's bytes and nothing else.
 */
export class GraphicFontFamilyFinder {
  constructor(private readonly catalog: ReadonlyArray<CatalogFamily>) {}

  /** Each bundled family `document` names, once for each spelling it uses. */
  find(document: GraphicDocument): RenamedFontFamily[] {
    const text = [document.css, document.html, document.js].join('\n');
    return this.catalog.flatMap(({ family }) => this.spellingsIn(text, family).map((as) => ({ family, as })));
  }

  private spellingsIn(text: string, family: string): string[] {
    const spellings: string[] = [];
    if (this.names(text, family, '')) spellings.push(family);
    const short = family.replace(VARIABLE_SUFFIX, '');
    if (short !== family && this.names(text, short, '|\\s+Variable\\b')) spellings.push(short);
    return spellings;
  }

  /** Whether `text` holds `name` on its own; `notFollowedBy` adds what may not come right after it. */
  private names(text: string, name: string, notFollowedBy: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\w-])${escaped}(?![\\w-]${notFollowedBy})`, 'i').test(text);
  }
}
