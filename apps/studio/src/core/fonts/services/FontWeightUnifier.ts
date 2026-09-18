import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';

const WHOLE_AXIS = '1 1000';
const REGULAR = 400;
const PIVOT = 500;

/**
 * Leaves the faces of a compiled family answering the same weights as
 * each other, which is what keeps any of them from leaving it.
 *
 * A compiled family holds several typefaces under one name and tells
 * them apart by `unicode-range`, and the browser settles weight over the
 * whole family before it reads that coverage. A weight only one of them
 * ships therefore takes every other face out of the family, and the
 * alphabets only they draw are drawn by whatever comes next.
 *
 * Faces already offering the same weights are left as they are: every
 * weight then answers with the whole family, so a family whose faces all
 * ship a regular and a bold draws its own bold. Otherwise each face is
 * cut down to one weight — the one the browser itself would pick for an
 * unweighted request: the lightest face from 400 up to the pivot, else
 * the heaviest below 400, else the lightest above the pivot.
 *
 * Cut down, they declare the weight they still agree on, or the whole
 * axis when even that differs. This is what decides whether such a
 * family can be drawn bold at all: a face whose declared range contains
 * the requested weight is read as already being that heavy, so the
 * browser neither reaches for a heavier file nor synthesizes one. Faces
 * that all ship a single weight keep it and are synthesized bold, while
 * a family mixing a variable face with a static one keeps the variable
 * face's real weights and draws the static one at its own.
 *
 * Weight is settled inside a style, so each style is cut down on its own.
 */
export class FontWeightUnifier {

  /**
   * The faces to write, under the family each came from, no one of them
   * answering a weight the others do not.
   */
  unify(
    byFace: ReadonlyMap<string, ReadonlyArray<FontFaceDeclaration>>,
  ): Map<string, FontFaceDeclaration[]> {
    if (this.offerTheSame(byFace)) {
      return new Map([...byFace].map(([family, declarations]) => [family, [...declarations]]));
    }
    const carried = new Map<string, FontFaceDeclaration[]>();
    for (const [family, declarations] of byFace) carried.set(family, this.regularsOf(declarations));
    const shared = this.sharedWeight([...carried.values()].flat());
    const unified = new Map<string, FontFaceDeclaration[]>();
    for (const [family, declarations] of carried) {
      unified.set(family, declarations.map((declaration) => ({
        ...declaration,
        descriptors: new Map(declaration.descriptors).set('font-weight', shared),
      })));
    }
    return unified;
  }

  /** Whether no request can tell the faces apart, every one of them answering the same style and weight descriptors. */
  private offerTheSame(byFace: ReadonlyMap<string, ReadonlyArray<FontFaceDeclaration>>): boolean {
    const answered = [...byFace.values()].map((declarations) => [...new Set(declarations.map(
      (declaration) => `${this.styleOf(declaration)}|${this.weightOf(declaration)}`,
    ))].sort().join());
    return answered.every((face) => face === answered[0]);
  }

  private regularsOf(declarations: ReadonlyArray<FontFaceDeclaration>): FontFaceDeclaration[] {
    const kept: FontFaceDeclaration[] = [];
    for (const group of this.groupedByStyle(declarations).values()) {
      const carried = this.regularAmong(group.map((declaration) => this.declaredWeight(declaration)));
      for (const declaration of group) {
        if (this.declaredWeight(declaration) === carried) kept.push(declaration);
      }
    }
    return kept;
  }

  private groupedByStyle(
    declarations: ReadonlyArray<FontFaceDeclaration>,
  ): ReadonlyMap<string, FontFaceDeclaration[]> {
    const groups = new Map<string, FontFaceDeclaration[]>();
    for (const declaration of declarations) {
      const style = this.styleOf(declaration);
      const group = groups.get(style) ?? [];
      group.push(declaration);
      groups.set(style, group);
    }
    return groups;
  }

  private regularAmong(weights: ReadonlyArray<number>): number {
    const sorted = [...new Set(weights)].sort((a, b) => a - b);
    return sorted.find((weight) => weight >= REGULAR && weight <= PIVOT)
      ?? [...sorted].reverse().find((weight) => weight < REGULAR)
      ?? sorted[0]!;
  }

  private sharedWeight(declarations: ReadonlyArray<FontFaceDeclaration>): string {
    const declared = new Set(declarations.map((declaration) => this.weightOf(declaration)));
    return declared.size === 1 ? [...declared][0]! : WHOLE_AXIS;
  }

  private styleOf(declaration: FontFaceDeclaration): string {
    return declaration.descriptors.get('font-style')?.trim() ?? 'normal';
  }

  private weightOf(declaration: FontFaceDeclaration): string {
    return declaration.descriptors.get('font-weight')?.trim() ?? String(REGULAR);
  }

  /** A range answers under its lightest end, which is where the browser starts reading it. */
  private declaredWeight(declaration: FontFaceDeclaration): number {
    const declared = declaration.descriptors.get('font-weight');
    if (declared === undefined) return REGULAR;
    const lightest = Number.parseInt(declared.trim(), 10);
    return Number.isNaN(lightest) ? REGULAR : lightest;
  }
}
