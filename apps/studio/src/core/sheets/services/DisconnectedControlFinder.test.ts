import { describe, expect, it } from 'vitest';
import { CssFilterReferenceScanner, CssMinifier, CssVarReferenceScanner } from '@tscaps/engine/advanced';
import { DisconnectedControlFinder, type StyleSources } from '@core/sheets/services/DisconnectedControlFinder';
import { ReferencedSvgFilterVariableScanner } from '@core/sheets/services/ReferencedSvgFilterVariableScanner';

function sources(css: string, filtersSvg = ''): StyleSources {
  return { css, filtersSvg };
}

function disconnected(authored: StyleSources, current: StyleSources): string[] {
  const finder = new DisconnectedControlFinder(
    new CssMinifier(),
    new CssVarReferenceScanner(),
    new CssFilterReferenceScanner(),
    new ReferencedSvgFilterVariableScanner(new CssVarReferenceScanner()),
  );
  return [...finder.find(authored, current)].sort();
}

const AUTHORED = sources('.word { color: var(--tscaps-primary-color, #fff); font-size: var(--tscaps-font-size, 3cqh) }');

describe('an untouched sheet', () => {
  it('has nothing disconnected', () => {
    expect(disconnected(AUTHORED, AUTHORED)).toEqual([]);
  });
});

describe('an edit to the stylesheet', () => {
  it('reports a control whose variable it replaced with a literal', () => {
    const edited = sources('.word { color: red; font-size: var(--tscaps-font-size, 3cqh) }');
    expect(disconnected(AUTHORED, edited)).toEqual(['primary-color']);
  });

  it('reports nothing when it only changed the fallback', () => {
    const edited = sources('.word { color: var(--tscaps-primary-color, #000); font-size: var(--tscaps-font-size, 9cqh) }');
    expect(disconnected(AUTHORED, edited)).toEqual([]);
  });

  it('reports a control it commented out, since a comment renders nothing', () => {
    const edited = sources('.word { /* color: var(--tscaps-primary-color, #fff) */ color: red; font-size: var(--tscaps-font-size, 3cqh) }');
    expect(disconnected(AUTHORED, edited)).toEqual(['primary-color']);
  });
});

describe('a control the author never wired through these documents', () => {
  it('is never reported, because application code may be driving it', () => {
    const edited = sources('.word { color: red; font-size: red }');
    expect(disconnected(AUTHORED, edited)).not.toContain('color-recipe');
  });

  it('leaves the result empty when the author wired nothing at all', () => {
    expect(disconnected(sources('.word { color: red }'), sources('.word { color: blue }'))).toEqual([]);
  });
});

const OUTLINE_SVG =
  '<filter id="outline"><feMorphology radius="var(--tscaps-outline-thickness)"/>'
  + '<feFlood flood-color="var(--tscaps-outline-color)"/></filter>';

describe('the filters document', () => {
  it('counts as a consumer, so a control only it reads is not reported', () => {
    const authored = sources('.word { filter: url(#outline) }', OUTLINE_SVG);
    expect(disconnected(authored, authored)).toEqual([]);
  });

  it('keeps a control alive when the stylesheet drops it but the filter still reads it', () => {
    const authored = sources('.word { filter: url(#outline); color: var(--tscaps-outline-color) }', OUTLINE_SVG);
    const edited = sources('.word { filter: url(#outline); color: red }', OUTLINE_SVG);
    expect(disconnected(authored, edited)).toEqual([]);
  });

  it('reports its controls when the stylesheet stopped pointing at the filter', () => {
    const authored = sources('.word { filter: url(#outline) }', OUTLINE_SVG);
    const edited = sources('.word { color: red }', OUTLINE_SVG);
    expect(disconnected(authored, edited)).toEqual(['outline-color', 'outline-thickness']);
  });

  it('reports its controls when the reference was commented out', () => {
    const authored = sources('.word { filter: url(#outline) }', OUTLINE_SVG);
    const edited = sources('.word { /* filter: url(#outline) */ color: red }', OUTLINE_SVG);
    expect(disconnected(authored, edited)).toEqual(['outline-color', 'outline-thickness']);
  });

  it('reports only the filter that lost its reference', () => {
    const svg = `${OUTLINE_SVG}<filter id="glitch"><feTurbulence seed="var(--tscaps-noise-seed)"/></filter>`;
    const authored = sources('.word { filter: url(#outline) url(#glitch) }', svg);
    const edited = sources('.word { filter: url(#outline) }', svg);
    expect(disconnected(authored, edited)).toEqual(['noise-seed']);
  });

  it('reports a control the edit parked in an XML comment, since a comment renders nothing', () => {
    const authored = sources('.word { filter: url(#outline) }', OUTLINE_SVG);
    const edited = sources(
      '.word { filter: url(#outline) }',
      '<filter id="outline"><feMorphology radius="var(--tscaps-outline-thickness)"/>'
      + '<!-- <feFlood flood-color="var(--tscaps-outline-color)"/> --></filter>',
    );
    expect(disconnected(authored, edited)).toEqual(['outline-color']);
  });
});
