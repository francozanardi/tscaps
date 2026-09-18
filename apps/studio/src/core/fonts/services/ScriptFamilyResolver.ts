import type { CatalogFamily } from '@core/fonts/domain/FontFamilyCatalog';
import { FONT_FAMILIES } from '@core/fonts/domain/FontFamilyCatalog';
import type { FontScript } from '@core/fonts/domain/FontScript';

/**
 * The catalog families offered for a writing system, so a picker for one
 * script lists what fits it and nothing else.
 *
 * Wider than the faces designed for the script: sixteen families ship
 * Cyrillic beside their own alphabet, so the designed ones alone would be
 * a fraction of what a reader can sensibly pick.
 */
export class ScriptFamilyResolver {

  constructor(private readonly families: ReadonlyArray<CatalogFamily> = FONT_FAMILIES) {}

  resolve(script: FontScript): string[] {
    return this.families
      .filter((entry) => entry.draws.includes(script))
      .map((entry) => entry.family);
  }
}
