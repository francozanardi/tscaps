import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';

const UPRIGHT = 'normal';

/**
 * Gives every face of a compiled family a declaration in every style
 * the family declares.
 *
 * Style is settled over the whole family before coverage is read, the
 * same way weight is, so a face with no italic of its own leaves the
 * family as soon as anything in it has one, and its alphabet is drawn
 * by whatever the list offers next. Measured: in a Latin/Greek family
 * whose Latin face ships an italic, italic Greek comes out in the Latin
 * face.
 *
 * A face with no italic stands in with its upright one, and is drawn
 * upright rather than slanted — the browser synthesizes an oblique only
 * where nothing in the family matches at all. For the scripts this
 * happens to most, which have no italic of their own to draw, upright
 * is also the truer answer.
 */
export class FontStyleCompleter {

  /** The faces to write, under the family each came from, none of them missing a style. */
  complete(
    byFace: ReadonlyMap<string, ReadonlyArray<FontFaceDeclaration>>,
  ): Map<string, FontFaceDeclaration[]> {
    const declared = this.stylesDeclared(byFace);
    const completed = new Map<string, FontFaceDeclaration[]>();
    for (const [family, declarations] of byFace) {
      completed.set(family, this.filled(declarations, declared));
    }
    return completed;
  }

  private stylesDeclared(byFace: ReadonlyMap<string, ReadonlyArray<FontFaceDeclaration>>): string[] {
    const declared: string[] = [];
    for (const declarations of byFace.values()) {
      for (const style of declarations.map((declaration) => this.styleOf(declaration))) {
        if (!declared.includes(style)) declared.push(style);
      }
    }
    return declared;
  }

  private filled(
    declarations: ReadonlyArray<FontFaceDeclaration>,
    declared: ReadonlyArray<string>,
  ): FontFaceDeclaration[] {
    const own = new Set(declarations.map((declaration) => this.styleOf(declaration)));
    const missing = declared.filter((style) => !own.has(style));
    if (missing.length === 0) return [...declarations];
    const standIn = this.standInOf(declarations);
    return [...declarations, ...missing.flatMap((style) => standIn.map((declaration) => ({
      ...declaration,
      descriptors: new Map(declaration.descriptors).set('font-style', style),
    })))];
  }

  /** The style a face answers a missing one with: its upright, or its only. */
  private standInOf(declarations: ReadonlyArray<FontFaceDeclaration>): FontFaceDeclaration[] {
    const upright = declarations.filter((declaration) => this.styleOf(declaration) === UPRIGHT);
    if (upright.length > 0) return upright;
    const first = this.styleOf(declarations[0]!);
    return declarations.filter((declaration) => this.styleOf(declaration) === first);
  }

  private styleOf(declaration: FontFaceDeclaration): string {
    return declaration.descriptors.get('font-style')?.trim() ?? UPRIGHT;
  }
}
