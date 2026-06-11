import type { FontFaceDeclaration } from '@core/templates/domain/FontFaceDeclaration';

/**
 * Returns the `@font-face` declarations for the requested families, drawn
 * from whichever stylesheets are currently registered. Returns the rules
 * unfiltered by `unicode-range`; callers downstream apply the codepoint
 * filter before serializing the final CSS.
 */
export interface FontFaceCssReader {
  read(families: ReadonlySet<string>): FontFaceDeclaration[];
}
