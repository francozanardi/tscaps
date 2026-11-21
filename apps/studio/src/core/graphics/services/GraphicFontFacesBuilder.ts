import type { CssResourceEmbedder } from '@tscaps/engine';
import type { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import type { GraphicFontFamilyFinder } from '@core/graphics/services/GraphicFontFamilyFinder';

/**
 * The `@font-face` rules of the bundled families a graphic names, with
 * their files held inline as `data:` URLs, the way a caption's fonts are
 * embedded for export: a graphic reaches nothing outside its page, and
 * the picture of it each frame is an SVG image, which loads nothing
 * external either.
 *
 * Only the subsets a graphic can draw with are embedded: those covering
 * a character its code or its fields' text holds. Its code always holds
 * the basic Latin letters, so a family's Latin subset always comes; a
 * field written in another alphabet brings that alphabet's subset too.
 */
export class GraphicFontFacesBuilder {
  constructor(
    private readonly families: GraphicFontFamilyFinder,
    private readonly fontFaces: FontFaceCssBuilder,
    private readonly embedder: CssResourceEmbedder,
  ) {}

  /** The rules for `document` played on `stage`, or the empty string when it names no bundled family. */
  async build(document: GraphicDocument, stage: GraphicStage): Promise<string> {
    const families = this.families.find(document);
    if (families.length === 0) return '';
    return this.embedder.embed(this.fontFaces.buildRenamed(families, this.codepointsOf(document, stage)));
  }

  private codepointsOf(document: GraphicDocument, stage: GraphicStage): ReadonlySet<number> {
    const texts = [document.css, document.html, document.js, ...Object.values(stage.params).map(String)];
    const codepoints = new Set<number>();
    for (const text of texts) {
      for (const character of text) codepoints.add(character.codePointAt(0)!);
    }
    return codepoints;
  }
}
