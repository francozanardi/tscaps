import { describe, expect, it } from 'vitest';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import { FontStyleCompleter } from '@core/fonts/services/FontStyleCompleter';

/**
 * The browser settles style over the whole family before it reads
 * coverage, so a face missing the style asked for is a face that leaves
 * the family — and its alphabet is then drawn by another face's
 * typeface.
 */

const completer = new FontStyleCompleter();

function face(family: string, style: string | null, unicodeRange = ''): FontFaceDeclaration {
  const descriptors = new Map([['font-weight', '400']]);
  if (style !== null) descriptors.set('font-style', style);
  return { family, source: `url(${family}-${style ?? 'plain'}.woff2)`, unicodeRange, metrics: null, descriptors };
}

function complete(...faces: FontFaceDeclaration[]): Map<string, FontFaceDeclaration[]> {
  const byFace = new Map<string, FontFaceDeclaration[]>();
  for (const declaration of faces) {
    byFace.set(declaration.family, [...(byFace.get(declaration.family) ?? []), declaration]);
  }
  return completer.complete(byFace);
}

function stylesOf(completed: Map<string, FontFaceDeclaration[]>, family: string): string[] {
  return completed.get(family)!.map((declaration) => declaration.descriptors.get('font-style') ?? 'normal');
}

describe('the styles every face of a compiled family answers for', () => {
  it('leaves a family whose faces all ship the same styles alone', () => {
    const completed = complete(
      face('EB Garamond', 'normal'), face('EB Garamond', 'italic'),
      face('Fraunces', 'normal'), face('Fraunces', 'italic'),
    );
    expect(stylesOf(completed, 'EB Garamond')).toEqual(['normal', 'italic']);
    expect(stylesOf(completed, 'Fraunces')).toEqual(['normal', 'italic']);
  });

  it('leaves a family with no italic at all alone', () => {
    const completed = complete(face('Anton', 'normal'), face('Press Start 2P', 'normal'));
    expect(stylesOf(completed, 'Press Start 2P')).toEqual(['normal']);
  });

  it('stands a face with no italic in with its upright one', () => {
    const completed = complete(
      face('EB Garamond', 'normal'), face('EB Garamond', 'italic'), face('Press Start 2P', 'normal'),
    );
    expect(stylesOf(completed, 'Press Start 2P')).toEqual(['normal', 'italic']);
    expect(completed.get('Press Start 2P')!.map((declaration) => declaration.source))
      .toEqual(['url(Press Start 2P-normal.woff2)', 'url(Press Start 2P-normal.woff2)']);
  });

  it('stands in with every subset of the face, not only its first', () => {
    const completed = complete(
      face('EB Garamond', 'italic'),
      face('Press Start 2P', 'normal', 'U+0-FF'), face('Press Start 2P', 'normal', 'U+370-3FF'),
    );
    expect(completed.get('Press Start 2P')!.filter(
      (declaration) => declaration.descriptors.get('font-style') === 'italic',
    ).map((declaration) => declaration.unicodeRange)).toEqual(['U+0-FF', 'U+370-3FF']);
  });

  it('stands a face with no upright in with the style it does ship', () => {
    const completed = complete(face('Amiri', 'italic'), face('Anton', 'normal'));
    expect(stylesOf(completed, 'Amiri')).toEqual(['italic', 'normal']);
    expect(completed.get('Amiri')!.every((declaration) => declaration.source === 'url(Amiri-italic.woff2)')).toBe(true);
  });

  it('reads a face that names no style as upright', () => {
    const completed = complete(face('Anton', null), face('EB Garamond', 'italic'));
    expect(stylesOf(completed, 'Anton')).toEqual(['normal', 'italic']);
  });
});
