import type { CatalogFamily } from '@core/fonts/domain/FontFamilyCatalog';
import { FONT_FAMILIES } from '@core/fonts/domain/FontFamilyCatalog';
import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { FontScript } from '@core/fonts/domain/FontScript';

/**
 * Which families of a `font-family` list can paint something, given the
 * alphabets the captions are written in.
 *
 * Answered the way the browser answers it: for each alphabet on screen,
 * the first family in the list that draws it. Every other name in the
 * list is unreachable — the browser stops before it — and a name that
 * paints nothing still costs its bytes in every rendered frame, once
 * for every element that names it.
 *
 * That matters most for a list this app wrote itself, which spells out
 * a face per writing system. Asking only whether a family draws some
 * alphabet on screen keeps the stand-ins that also happen to cover
 * Latin, and they are exactly the ones the list can never reach.
 *
 * A family the catalog does not describe counts as drawing whatever is
 * left: an uploaded font has no declared coverage, and dropping it
 * would silently take away the one face the reader supplied.
 */
export class DrawingFamilyFilter {

  private readonly drawnScripts: ReadonlyMap<string, ReadonlyArray<FontScript>>;

  constructor(families: ReadonlyArray<CatalogFamily> = FONT_FAMILIES) {
    this.drawnScripts = new Map(families.map((entry) => [entry.family, entry.draws]));
  }

  /**
   * Text carrying no letters of a known script answers the first family
   * alone: the captions are punctuation or digits, which any face
   * paints and the first one will.
   */
  reachable(families: ReadonlyArray<string>, scripts: CaptionScripts): Set<string> {
    if (scripts.present.size === 0) return new Set(families.slice(0, 1));
    const reached = new Set<string>();
    for (const script of scripts.present) {
      const first = families.find((family) => this.draws(family, script));
      if (first !== undefined) reached.add(first);
    }
    return reached;
  }

  private draws(family: string, script: FontScript): boolean {
    const drawn = this.drawnScripts.get(family);
    if (drawn === undefined) return true;
    return drawn.some((one) => (one === 'urdu' ? 'arabic' : one) === script);
  }
}
