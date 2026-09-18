import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { Document } from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import { FontMetrics } from '@core/fonts/domain/FontMetrics';
import type { FontMetricsReader } from '@core/fonts/domain/FontMetricsReader';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { CssFontFamilyReader } from '@core/fonts/services/CssFontFamilyReader';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { DrawingFamilyFilter } from '@core/fonts/services/DrawingFamilyFilter';
import { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import { FontFaceCssWriter } from '@core/fonts/services/FontFaceCssWriter';
import { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { FontStackCompiler } from '@core/fonts/services/FontStackCompiler';
import { FontStyleCompleter } from '@core/fonts/services/FontStyleCompleter';
import { FontWeightUnifier } from '@core/fonts/services/FontWeightUnifier';
import { FontStackCssVarsBuilder } from '@core/fonts/services/FontStackCssVarsBuilder';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';
import { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';

/**
 * That the rules written for a sheet define the families the sheet's
 * CSS asks for.
 *
 * The two are produced by different classes from the same inputs and
 * find each other by name alone, and a mismatch is silent: the value
 * falls back to the faces spelled behind the name, which renders, so
 * every other test still passes while the compiled family — the whole
 * point — draws nothing.
 *
 * And that the rules carry the faces that draw and no others. Every
 * `url()` here is fetched and inlined into the stylesheet that ships
 * with *each rendered frame*, so a face nothing can reach is not a
 * tidiness problem: it is megabytes per frame. The faces come from the
 * real packages, because which files a family ships is the thing being
 * counted.
 */

const require = createRequire(import.meta.url);
const library = new FontStackLibrary();
const familyReader = new CssFontFamilyReader();

/** Every `@font-face` the app registers, read from the packages `fonts.css` imports. */
function catalogDeclarations(): FontFaceDeclaration[] {
  const imported = readFileSync('src/styles/fonts.css', 'utf8');
  const out: FontFaceDeclaration[] = [];
  for (const packageName of [...imported.matchAll(/@import '([^']+)'/g)].map((match) => match[1]!)) {
    let indexCss: string;
    try {
      indexCss = require.resolve(packageName.endsWith('.css') ? packageName : `${packageName}/index.css`);
    } catch {
      continue;
    }
    for (const block of readFileSync(indexCss, 'utf8').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const descriptors = new Map<string, string>();
      for (const line of block[1]!.split(';')) {
        const separator = line.indexOf(':');
        if (separator > 0) descriptors.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      }
      const family = descriptors.get('font-family')!.replace(/['"]/g, '');
      const source = descriptors.get('src')!.replace(
        /url\((\.\/[^)]+)\)/g,
        (_, relative: string) => `url(${join(dirname(indexCss), relative)})`,
      );
      const unicodeRange = descriptors.get('unicode-range') ?? '';
      for (const owned of ['font-family', 'src', 'unicode-range']) descriptors.delete(owned);
      out.push({ family, source, unicodeRange, descriptors, metrics: null });
    }
  }
  return out;
}

const CATALOG = catalogDeclarations();

class CatalogRegistered implements FontFaceCssReader {
  read(families: ReadonlySet<string>): FontFaceDeclaration[] {
    return CATALOG.filter((declaration) => families.has(declaration.family));
  }
}

class EveryFamilyRegistered implements FontFaceCssReader {
  read(families: ReadonlySet<string>): FontFaceDeclaration[] {
    return [...families].map((family) => ({
      family,
      source: `url(/${family}.woff2) format('woff2')`,
      unicodeRange: '',
      descriptors: new Map([['font-weight', '400']]),
      metrics: null,
    }));
  }
}

class EveryFamilyMeasured implements FontMetricsReader {
  read(): FontMetrics {
    return new FontMetrics(1.18, 0.33);
  }
}

function newFacesBuilder(faceReader: FontFaceCssReader = new EveryFamilyRegistered()): SheetFontFacesBuilder {
  const rangeParser = new UnicodeRangeParser();
  const cssWriter = new FontFaceCssWriter(new FontFaceSourceTrimmer());
  return new SheetFontFacesBuilder(
    new SheetFontFamilyCollector(
      new DrawableFamilyResolver(),
      new FontScriptClassifier(),
      new SheetCaptionTextCollector(),
      familyReader,
      new DrawingFamilyFilter(),
      library,
    ),
    new FontStackCompiler(
      new DrawableFamilyResolver(),
      new CompiledFamilyNamer(),
      faceReader,
      new EveryFamilyMeasured(),
      rangeParser,
      cssWriter,
      new FontWeightUnifier(),
      new FontStyleCompleter(),
    ),
    new FontFaceCssBuilder(faceReader, rangeParser, cssWriter),
  );
}

const SCRIPTS = new CaptionScripts('latin', new Set(['latin', 'arabic']));
const EMPTY_DOCUMENT = { sections: [] } as unknown as Document;

/** One caption holding one word, so an element's own stack is reachable. */
function documentHolding(wordId: string): Document {
  const words = [{ id: wordId, displayText: 'hola' }];
  return {
    sections: [{ kind: 'main', segments: [{ id: 's1', getWords: () => words, lines: [{ words }] }] }],
  } as unknown as Document;
}

function sheetWith(css: string): Sheet {
  return {
    id: 'main',
    scripts: SCRIPTS,
    typographyConfig: { fontStack: library.stackFor('anton') },
    template: { fontStackIds: [], styleControls: [] },
    styleValues: { values: {} },
    resolveCss: () => css,
  } as unknown as Sheet;
}

/** Every family the written rules define. */
function definedIn(css: string): Set<string> {
  return new Set([...css.matchAll(/font-family:'([^']+)'/g)].map((match) => match[1]!));
}

/** The family a declaration draws with, which is the one it names first. */
function drawnBy(css: string): string {
  return /font-family:\s*'([^']+)'/.exec(css)![1]!;
}

describe('the rules a sheet is rendered with', () => {
  it('preserve a literal family named in authored CSS', () => {
    const authored = `.accent { font-family: 'Kalam'; }`;
    const sheet = sheetWith(authored);
    const written = newFacesBuilder().build({
      sheet,
      document: EMPTY_DOCUMENT,
      sheetCss: authored,
      elementStyles: ElementStyles.empty(),
      usedCodepoints: null,
    });
    expect(definedIn(written)).toContain(drawnBy(authored));
  });

  it('define the family an element given a font of its own ends up asking for', () => {
    const sheet = sheetWith('.segment { color: red }');
    const chosen = library.stackFor('lora');
    const elementStyles = ElementStyles.fromSnapshot({
      w1: { kind: 'word', css: '', fields: { 'font-family': chosen.toSnapshot() } },
    } as never);
    const written = newFacesBuilder().build({
      sheet,
      document: documentHolding('w1'),
      sheetCss: sheet.resolveCss(),
      elementStyles,
      usedCodepoints: null,
    });
    const resolver = new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver());
    expect(definedIn(written)).toContain(drawnBy(`font-family: ${resolver.resolve(chosen, SCRIPTS)}`));
  });

  it('define the family the sheet itself is set in', () => {
    const sheet = sheetWith('.segment { color: red }');
    const written = newFacesBuilder().build({
      sheet,
      document: EMPTY_DOCUMENT,
      sheetCss: sheet.resolveCss(),
      elementStyles: ElementStyles.empty(),
      usedCodepoints: null,
    });
    const resolver = new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver());
    const asked = resolver.resolve(sheet.typographyConfig.fontStack, SCRIPTS);
    expect(definedIn(written)).toContain(drawnBy(`font-family: ${asked}`));
  });
});

/** The font files the rules point at, by their file name. */
function filesIn(css: string): string[] {
  return [...css.matchAll(/url\(([^)]+)\)/g)].map((url) => url[1]!.replace(/['"]/g, '').split('/').pop()!);
}

function facesFor(sheet: Sheet, elementStyles: ElementStyles, text: string): string[] {
  const usedCodepoints = new Set<number>();
  for (const character of text + text.toUpperCase() + text.toLowerCase()) {
    usedCodepoints.add(character.codePointAt(0)!);
  }
  return filesIn(newFacesBuilder(new CatalogRegistered()).build({
    sheet,
    document: documentHolding('w1'),
    sheetCss: sheet.resolveCss(),
    elementStyles,
    usedCodepoints,
  }));
}

/** A whole stack spelled into an element's CSS by hand, its Latin face first. The panels write no font declaration. */
function elementGiven(stackId: string): ElementStyles {
  const spelled = library.stackFor(stackId).ledBy('latin').map((family) => `'${family}'`).join(', ');
  return ElementStyles.fromSnapshot({
    w1: { kind: 'word', css: `#w1 { font-family: ${spelled} }`, fields: {} },
  } as never);
}

const LATIN_ONLY = new CaptionScripts('latin', new Set(['latin']));

describe('the faces a frame carries', () => {
  const latinSheet = (css: string): Sheet => ({
    ...sheetWith(css), scripts: LATIN_ONLY,
  } as unknown as Sheet);

  it('are only the sheet\'s own, for a caption in one alphabet', () => {
    const sheet = latinSheet(`.segment { font-family: var(--tscaps-font-family, 'Anton') }`);
    expect(facesFor(sheet, ElementStyles.empty(), 'hola mundo')).toEqual(['anton-latin-400-normal.woff2']);
  });

  // A stack spelled out by hand names one face per writing system. Only
  // the one drawing the alphabet on screen can ever be reached; the rest
  // would ride into every frame unread.
  it('add one face, not a stack, for an element given a font', () => {
    const sheet = latinSheet(`.segment { font-family: var(--tscaps-font-family, 'Anton') }`);
    const files = facesFor(sheet, elementGiven('lora'), 'hola mundo');
    expect(files).toHaveLength(2);
    expect(files.join(' ')).toContain('lora');
  });

  it('carry no face for an alphabet the captions do not hold', () => {
    const sheet = latinSheet(`.segment { font-family: var(--tscaps-font-family, 'Anton') }`);
    const files = facesFor(sheet, elementGiven('lora'), 'hola mundo').join(' ');
    for (const absent of ['amiri', 'assistant', 'nastaliq', 'garamond', 'poppins']) {
      expect(files).not.toContain(absent);
    }
  });

  it('carry the face for an alphabet the captions do hold', () => {
    const mixed = { ...sheetWith(`.segment { color: white }`), scripts: SCRIPTS } as unknown as Sheet;
    expect(facesFor(mixed, ElementStyles.empty(), 'hola مرحبا').join(' ')).toContain('lalezar');
  });
});

describe('fixed template font dependencies', () => {
  it('defines the family its variable references, without a font control', () => {
    const base = sheetWith('.accent { font-family: var(--tscaps-font-stack-kalam); }');
    const sheet = { ...base, template: { ...base.template, fontStackIds: ['kalam'] } } as unknown as Sheet;
    const written = newFacesBuilder().build({
      sheet, document: EMPTY_DOCUMENT, sheetCss: sheet.resolveCss(), elementStyles: ElementStyles.empty(), usedCodepoints: null,
    });
    const vars = new FontStackCssVarsBuilder(
      library, new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver()),
    ).build(sheet.template.fontStackIds, sheet.scripts);
    expect(definedIn(written)).toContain(drawnBy(`font-family: ${vars['--tscaps-font-stack-kalam']}`));
  });

  it('embeds only the fixed stack subsets needed by the caption text', () => {
    const base = sheetWith('.accent { font-family: var(--tscaps-font-stack-kalam); }');
    const sheet = { ...base, scripts: LATIN_ONLY, template: { ...base.template, fontStackIds: ['kalam'] } } as unknown as Sheet;
    const files = facesFor(sheet, ElementStyles.empty(), 'hola mundo');
    expect(files).toContain('kalam-latin-400-normal.woff2');
    expect(files.some((file) => file.includes('devanagari') || file.includes('arabic') || file.includes('hebrew'))).toBe(false);
  });
});
