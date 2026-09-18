import { resolve } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import { SvgFilterDefinitionsParser, TagConditionParser } from '@tscaps/engine';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { BuiltinAssetRepository } from '@core/assets/infrastructure/repositories/BuiltinAssetRepository';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { BehindActorTemplateConfigSerializer } from '@core/person-segmentation/services/BehindActorTemplateConfigSerializer';
import { Sheet } from '@core/sheets/domain/Sheet';
import { TypographyConfigSerializer } from '@core/sheets/services/TypographyConfigSerializer';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { BuiltinTemplateAssetsBuilder } from '@core/templates/infrastructure/BuiltinTemplateAssetsBuilder';
import { LocalFileTemplateLoader } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import { BoxEdgesShorthandParser } from '@core/templates/services/BoxEdgesShorthandParser';
import { CssAssetReferenceResolver } from '@core/templates/services/CssAssetReferenceResolver';
import { StyleControlResolver } from '@core/templates/services/controls/StyleControlResolver';
import { TemplateFontStackRegistry } from '@core/templates/services/fonts/TemplateFontStackRegistry';
import { TemplateContractValidatorFactory } from '@core/templates/services/contract/TemplateContractValidatorFactory';
import { TemplateRecordMigrator } from '@core/templates/services/TemplateRecordMigrator';
import { TemplateSerializer } from '@core/templates/services/TemplateSerializer';
import { TemplateFromSheetBuilder } from '@core/user-templates/services/TemplateFromSheetBuilder';
// eslint-disable-next-line no-restricted-syntax -- Build scripts have no runtime alias; exercise the real Sass callback.
import { fontStackFunction } from '../../../../../scripts/font-stack-function';

const library = new FontStackLibrary();
const assetsResolver = new CssAssetReferenceResolver(new BuiltinAssetRepository([]));
const svgParser = new SvgFilterDefinitionsParser();
const tagParser = new TagConditionParser();
const serializer = new TemplateSerializer(
  assetsResolver, svgParser, new TemplateRecordMigrator(new StoredFontStackReader(library)),
  new BehindActorTemplateConfigSerializer(tagParser), new TypographyConfigSerializer(),
);

function compileTemplate(extraCss: string) {
  const registry = new TemplateFontStackRegistry(library);
  const { css } = compileString(`
    @use 'font-stack' as *;
    @use 'segment-typography' as *;
    .segment { @include segment-typography($font-family: 'Inter Variable', $font-size: 4cqh); }
    .word { text-decoration: var(--tscaps-text-decoration); }
    .line { word-spacing: var(--tscaps-word-spacing); margin-top: var(--tscaps-line-spacing); }
    ${extraCss}
  `, {
    loadPaths: [resolve('../../templates/_lib')],
    functions: { 'tscaps-font-stack($id)': fontStackFunction(registry) },
  });
  return { css, ids: registry.declared() };
}

async function loadTemplate(css: string, ids: readonly string[]) {
  const assets = new BuiltinTemplateAssetsBuilder(
    { '/templates/example/style.build.css': css },
    { '/templates/example/template.json': { name: 'Example' } },
    {}, {}, {}, { '/templates/example/fonts.build.json': ids },
  ).build();
  return new LocalFileTemplateLoader(
    assets, assetsResolver, new SegmentSplitterRegistry(), new LineSplitterRegistry(), new EffectRegistry(),
    svgParser, new BoxEdgesShorthandParser(), tagParser,
    new StyleControlResolver(new StyleControlCatalog(new SimilarNameFinder()), library), library,
  ).load('example');
}

describe('fixed font dependencies declared from Sass', () => {
  it('loads each referenced stack once, without exposing any controls', async () => {
    const built = compileTemplate(`
      .accent { font-family: font-stack('kalam'); }
      .secondary { font-family: font-stack('inter'); }
      .another { font-family: font-stack('kalam'); }
    `);
    const template = await loadTemplate(built.css, built.ids);
    expect(template.fontStackIds).toEqual(['kalam', 'inter']);
    expect(template.styleControls).toEqual([]);
  });

  it('accepts declared variables in the CSS contract and rejects references without a declaration', () => {
    const built = compileTemplate(`.accent { font-family: font-stack('kalam'); }`);
    const validator = new TemplateContractValidatorFactory(new StyleControlCatalog(new SimilarNameFinder())).create(new Set());
    const context = { styleControlIds: [], filterIds: new Set<string>(), fontStackIds: built.ids };
    expect(validator.validateCss(built.css, context)).toEqual([]);
    expect(validator.validateCss(built.css, { ...context, fontStackIds: [] }).some((violation) =>
      violation.message.includes('--tscaps-font-stack-kalam'),
    )).toBe(true);
  });

  it('does not register a function call in an unused Sass branch', () => {
    const built = compileTemplate(`@if false { .unused { font-family: font-stack('kalam'); } }`);
    expect(built.ids).toEqual([]);
  });

  it.each(["'not-a-stack'", '42'])('rejects an invalid reference: %s', (argument) => {
    expect(() => compileTemplate(`.accent { font-family: font-stack(${argument}); }`)).toThrow();
  });

  it('fails outside the template build instead of emitting an unresolved Sass function', () => {
    expect(() => compileString(`@use 'font-stack' as *; .accent { font-family: font-stack('kalam'); }`, {
      loadPaths: [resolve('../../templates/_lib')],
    })).toThrow('requires the tscaps template build');
  });

  it('preserves dependencies when a sheet is saved as a template and reloaded', async () => {
    const built = compileTemplate(`.accent { font-family: font-stack('kalam'); }`);
    const template = await loadTemplate(built.css, built.ids);
    const sheet = Sheet.fromTemplate('main', 'Main', null, template, 'ltr');
    const saved = new TemplateFromSheetBuilder(svgParser).build(sheet, { id: 'saved', name: 'Saved' });
    const reloaded = serializer.deserialize(JSON.parse(JSON.stringify(serializer.serialize(saved))));
    expect(reloaded.fontStackIds).toEqual(['kalam']);
    expect(reloaded.getCss()).toBe(template.getCss());
    expect(reloaded.styleControls).toEqual([]);
  });

  it('loads older templates without font dependencies and filters malformed stored IDs', async () => {
    const built = compileTemplate('');
    const record = serializer.serialize(await loadTemplate(built.css, built.ids));
    const { fontStackIds: omitted, ...older } = record;
    expect(omitted).toEqual([]);
    expect(serializer.deserialize(older).fontStackIds).toEqual([]);
    expect(serializer.deserialize({ ...record, fontStackIds: ['kalam', 5, 'kalam', "bad');}"] }).fontStackIds)
      .toEqual(['kalam']);
  });
});
