import { describe, expect, it } from 'vitest';
import { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';

/**
 * What a rule offers, and what an export is willing to carry.
 *
 * Every `url()` a rule lists is fetched and inlined as a data URI into
 * the stylesheet that ships with each rendered frame, so a family
 * offered as woff2 *and* woff rode into every frame twice — the second
 * copy for a browser that cannot be the one rendering.
 *
 * Assertions are on which sources survive, never on the exact text: the
 * spacing is nobody's promise.
 */

const trimmer = new FontFaceSourceTrimmer();

function sourcesIn(value: string): string[] {
  return [...value.matchAll(/url\(([^)]*)\)|local\(([^)]*)\)/g)].map((m) => (m[1] ?? m[2])!.trim());
}

describe('a src offering both formats', () => {
  const BOTH = `url(./files/lalezar-latin-400-normal.woff2) format('woff2'), `
    + `url(./files/lalezar-latin-400-normal.woff) format('woff')`;

  it('keeps the woff2 and drops the woff', () => {
    expect(sourcesIn(trimmer.trim(BOTH))).toEqual(['./files/lalezar-latin-400-normal.woff2']);
  });

  it('keeps the format the surviving source was offered in', () => {
    expect(trimmer.trim(BOTH)).toContain("format('woff2')");
  });
});

describe('a src with nothing to drop', () => {
  it('leaves a woff2-only value exactly as it was', () => {
    const src = `url(/assets/komika-axis.woff2) format('woff2')`;
    expect(trimmer.trim(src)).toBe(src);
  });

  it('leaves an uploaded font on its own format', () => {
    const src = `url(blob:http://localhost/abc) format('truetype')`;
    expect(trimmer.trim(src)).toBe(src);
  });

  // Without a woff2 to supersede it, the woff is the only file there is.
  it('keeps a lone woff', () => {
    const src = `url(/assets/old.woff) format('woff')`;
    expect(trimmer.trim(src)).toBe(src);
  });

  it('leaves an empty value alone', () => {
    expect(trimmer.trim('')).toBe('');
  });
});

describe('sources that are not files', () => {
  it('keeps a local face, which costs no bytes at all', () => {
    const src = `local('Inter'), url(/assets/inter.woff2) format('woff2'), url(/assets/inter.woff) format('woff')`;
    expect(sourcesIn(trimmer.trim(src))).toEqual(["'Inter'", '/assets/inter.woff2']);
  });

  // A comma inside the value must not read as a source boundary.
  it('survives a url carrying a comma', () => {
    const src = `url("/assets/a,b.woff2") format('woff2'), url("/assets/a,b.woff") format('woff')`;
    expect(sourcesIn(trimmer.trim(src))).toEqual(['"/assets/a,b.woff2"']);
  });
});
