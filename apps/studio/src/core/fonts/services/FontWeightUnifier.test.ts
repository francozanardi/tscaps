import { describe, expect, it } from 'vitest';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import { FontWeightUnifier } from '@core/fonts/services/FontWeightUnifier';

/**
 * A compiled family tells its typefaces apart by coverage alone, which
 * holds only while no weight answers with some of them and not others.
 * A weight only one face ships takes every other face out of the family;
 * widening the weight they declare instead takes the family's bold away,
 * since a face whose range contains the request is one the browser reads
 * as already that heavy.
 */

const unifier = new FontWeightUnifier();

function face(family: string, descriptors: Record<string, string>, unicodeRange = ''): FontFaceDeclaration {
  return {
    family, source: `url(${family}.woff2)`, unicodeRange, metrics: null,
    descriptors: new Map(Object.entries(descriptors)),
  };
}

/** A face whose family ships one weight, which the others then have to be cut down to meet. */
const DISSENTING = face('Press Start 2P', { 'font-weight': '400' });

function unify(...faces: FontFaceDeclaration[]): FontFaceDeclaration[] {
  const byFace = new Map<string, FontFaceDeclaration[]>();
  for (const declaration of faces) {
    byFace.set(declaration.family, [...(byFace.get(declaration.family) ?? []), declaration]);
  }
  return [...unifier.unify(byFace).values()].flat();
}

function weightsOf(...faces: FontFaceDeclaration[]): string[] {
  return unify(...faces).map((kept) => kept.descriptors.get('font-weight')!);
}

describe('the weight a compiled family carries', () => {
  it('leaves faces that already agree declaring what they ship', () => {
    expect(weightsOf(face('Anton', { 'font-weight': '400' }), face('Press Start 2P', { 'font-weight': '400' })))
      .toEqual(['400', '400']);
  });

  it('leaves a family of variable faces on the range they share', () => {
    expect(weightsOf(face('Inter', { 'font-weight': '100 900' }), face('Heebo', { 'font-weight': '100 900' })))
      .toEqual(['100 900', '100 900']);
  });

  it('widens to the whole axis only when the faces disagree', () => {
    expect(weightsOf(face('Anton', { 'font-weight': '400' }), face('Montserrat', { 'font-weight': '100 900' })))
      .toEqual(['1 1000', '1 1000']);
  });

  it('keeps both weights of a family whose faces all ship both', () => {
    const kept = unify(
      face('Poppins', { 'font-weight': '400' }), face('Poppins', { 'font-weight': '700' }),
      face('Amiri', { 'font-weight': '400' }), face('Amiri', { 'font-weight': '700' }),
    );
    expect(kept.map((one) => one.descriptors.get('font-weight'))).toEqual(['400', '700', '400', '700']);
  });

  it('keeps only the regular once one face cannot answer the bold', () => {
    const regular = face('Poppins', { 'font-weight': '400' }, 'U+900-97F');
    const bold = face('Poppins', { 'font-weight': '700' }, 'U+900-97F');
    const kept = unify(regular, bold, DISSENTING);
    expect(kept).toHaveLength(2);
    expect(kept[0]!.source).toBe(regular.source);
  });

  it('never leaves two weights in the family, whatever its faces ship', () => {
    const weights = weightsOf(
      face('A', { 'font-weight': '100' }), face('B', { 'font-weight': '400' }),
      face('C', { 'font-weight': '700' }), face('D', { 'font-weight': '900' }),
    );
    expect(new Set(weights).size).toBe(1);
  });

  it('reaches for the lightest above the pivot when the family ships nothing under it', () => {
    const nine = face('Anton', { 'font-weight': '900' });
    const seven = face('Anton', { 'font-weight': '700' });
    const kept = unify(nine, seven, DISSENTING);
    expect(kept).toHaveLength(2);
    expect(kept[0]!.source).toBe(seven.source);
  });

  it('keeps every subset of the carried file, which share its weight', () => {
    expect(weightsOf(
      face('Anton', { 'font-weight': '400' }, 'U+0-FF'),
      face('Anton', { 'font-weight': '400' }, 'U+100-2BA'),
    )).toEqual(['400', '400']);
  });

  it('cuts each style down on its own, since weight is settled inside one', () => {
    const kept = unify(
      face('EB Garamond', { 'font-weight': '400' }),
      face('EB Garamond', { 'font-weight': '700' }),
      face('EB Garamond', { 'font-weight': '400', 'font-style': 'italic' }),
      DISSENTING,
    );
    expect(kept.map((one) => one.descriptors.get('font-style') ?? 'normal')).toEqual(['normal', 'italic', 'normal']);
  });
});
