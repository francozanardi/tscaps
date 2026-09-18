import { Document, Section, Segment, Line, Word, TimeFragment } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SheetScriptsAutomation } from '@core/editor/automations/SheetScriptsAutomation';
import { Sheet, type SheetProps } from '@core/sheets/domain/Sheet';
import { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileString } from 'sass';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { FontStackCssVarsBuilder } from '@core/fonts/services/FontStackCssVarsBuilder';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { TemplateFontStackRegistry } from '@core/templates/services/fonts/TemplateFontStackRegistry';
// eslint-disable-next-line no-restricted-syntax -- Build scripts have no runtime alias; exercise the real Sass callback.
import { fontStackFunction } from '../../../../scripts/font-stack-function';
import { createRequire } from 'node:module';
import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import { FontMetrics } from '@core/fonts/domain/FontMetrics';
import type { FontMetricsReader } from '@core/fonts/domain/FontMetricsReader';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontScript } from '@core/fonts/domain/FontScript';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { FontFaceCssWriter } from '@core/fonts/services/FontFaceCssWriter';
import { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';
import { FontStackCompiler } from '@core/fonts/services/FontStackCompiler';
import { FontStyleCompleter } from '@core/fonts/services/FontStyleCompleter';
import { FontWeightUnifier } from '@core/fonts/services/FontWeightUnifier';
import { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

/**
 * What a compiled stack promises, asked of a browser.
 *
 * The oracle has to be a real layout engine. Every property here is one
 * CSS resolves and no amount of reading the generated text can confirm:
 * which face draws a character two faces cover, where a line's baseline
 * lands, how tall the box around a word comes out. The generated CSS was
 * *always* what the compiler meant to generate; what differed was what
 * the browser did with it.
 *
 * Faces come from the real Fontsource packages, ranges and all, because
 * the subtraction the compiler does is only meaningful against the
 * ranges those packages actually ship.
 */

const LATIN_FACE = 'Anton';
const ARABIC_FACE = 'Lalezar';
const ARABIC_TEXT = 'مرحبا';
const LATIN_TEXT = 'hey';
// Curly apostrophe, em dash and ellipsis: General Punctuation, which the
// Latin subset of a face covers and a per-alphabet block would not.
const PUNCTUATION_TEXT = 'don’t—yes…';
const FONT_SIZE_PX = 100;

const require = createRequire(import.meta.url);
let browser: Browser;
let page: Page;
let metrics: StubFontMetricsReader;

class StubFontFaceReader implements FontFaceCssReader {
  constructor(private readonly declarations: ReadonlyArray<FontFaceDeclaration>) {}
  read(families: ReadonlySet<string>): FontFaceDeclaration[] {
    return this.declarations.filter((declaration) => families.has(declaration.family));
  }
}

class StubFontMetricsReader implements FontMetricsReader {
  private readonly known = new Map<string, FontMetrics>();
  remember(family: string, metrics: FontMetrics): void {
    this.known.set(family, metrics);
  }
  read(family: string): FontMetrics | null {
    return this.known.get(family) ?? null;
  }
}

/** Every `@font-face` a Fontsource entry file declares, with its files inlined. */
function packageFaces(packageName: string, entry = 'index.css'): FontFaceDeclaration[] {
  const indexCss = require.resolve(`${packageName}/${entry}`);
  const css = readFileSync(indexCss, 'utf8');
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((block) => {
    const descriptors = new Map<string, string>();
    for (const line of block[1]!.split(';')) {
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      descriptors.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
    const family = descriptors.get('font-family')!.replace(/['"]/g, '');
    const source = inlineSources(descriptors.get('src')!, dirname(indexCss));
    const unicodeRange = descriptors.get('unicode-range') ?? '';
    for (const owned of ['font-family', 'src', 'unicode-range']) descriptors.delete(owned);
    return { family, source, unicodeRange, descriptors, metrics: null };
  });
}

function inlineSources(source: string, packageDirectory: string): string {
  return source.replace(/url\((\.\/[^)]+\.woff2)\)/g, (_, relative: string) => {
    const bytes = readFileSync(join(packageDirectory, relative)).toString('base64');
    return `url(data:font/woff2;base64,${bytes})`;
  });
}

function newCompiler(faces: ReadonlyArray<FontFaceDeclaration>): FontStackCompiler {
  return new FontStackCompiler(
    new DrawableFamilyResolver(),
    new CompiledFamilyNamer(),
    new StubFontFaceReader(faces),
    metrics,
    new UnicodeRangeParser(),
    new FontFaceCssWriter(new FontFaceSourceTrimmer()),
    new FontWeightUnifier(),
    new FontStyleCompleter(),
  );
}

function stackOf(latin: string, arabic: string): FontStack {
  return FontStack.of({
    latin,
    arabic,
    urdu: arabic,
    hebrew: latin,
    cyrillic: latin,
    greek: latin,
    devanagari: latin,
    bengali: latin,
    telugu: latin,
    tamil: latin,
    thai: latin,
  });
}

interface Box {
  readonly height: number;
  readonly baseline: number;
  readonly width: number;
}

/**
 * Lays each sample out as an inline-block word inside its own line and
 * reports the box the browser gave it. The zero-height probe beside the
 * word sits its bottom edge on the line's baseline.
 */
async function boxesOf(
  fontFaceCss: string,
  samples: ReadonlyArray<{
    readonly family: string;
    readonly text: string;
    readonly weight?: number;
    readonly style?: 'normal' | 'italic';
  }>,
): Promise<Box[]> {
  const lines = samples.map((sample, index) =>
    `<div class="line" style="font-family:${sample.family};font-weight:${sample.weight ?? 400};`
    + `font-style:${sample.style ?? 'normal'}">`
    + `<span class="word" id="w${index}">${sample.text}</span><span class="probe"></span></div>`,
  ).join('\n');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaceCss}
body{margin:0;font-size:${FONT_SIZE_PX}px;line-height:normal}
.line{display:block;width:3000px}
.word{display:inline-block}
.probe{display:inline-block;width:0;height:0;overflow:hidden}
</style></head><body>${lines}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((count) => Array.from({ length: count }, (_, index) => {
    const word = document.getElementById(`w${index}`)!;
    const line = word.parentElement!;
    const wordBox = word.getBoundingClientRect();
    const probe = line.querySelector('.probe')!.getBoundingClientRect();
    return {
      height: Number(wordBox.height.toFixed(1)),
      baseline: Number((probe.bottom - wordBox.top).toFixed(1)),
      width: Number(wordBox.width.toFixed(1)),
    };
  }), samples.length);
}

/** Measures each face the way the app does at runtime, so the stubbed metrics are the real ones. */
async function measureFaces(fontFaceCss: string, families: ReadonlyArray<string>): Promise<void> {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss}
body{margin:0;font-size:${FONT_SIZE_PX}px;line-height:normal}</style></head><body></body></html>`,
  { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const measured = await page.evaluate(async ({ families, size }) => {
    // A face nothing on the page draws is a face the browser has not
    // fetched, and an unfetched face measures as whatever stands in for
    // it. The app has the same requirement and meets it by asking
    // `fonts.check` before measuring.
    await Promise.all(families.map((family) => document.fonts.load(`${size}px '${family}'`)));
    return families.map((family) => {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;visibility:hidden;font-family:'${family}';`
        + `font-size:${size}px;line-height:normal;`;
      const baseline = document.createElement('span');
      baseline.style.cssText = 'display:inline-block;width:0;height:0;';
      line.appendChild(baseline);
      document.body.appendChild(line);
      const box = line.getBoundingClientRect();
      const ascent = baseline.getBoundingClientRect().bottom - box.top;
      line.remove();
      return { family, ascent: ascent / size, descent: (box.height - ascent) / size };
    });
  }, { families: [...families], size: FONT_SIZE_PX });
  for (const face of measured) metrics.remember(face.family, new FontMetrics(face.ascent, face.descent));
}

/**
 * Ink each sample covers, in pixels, drawn on a canvas at the requested
 * weight. Bold is what a box cannot see: a synthesized bold thickens the
 * strokes of a face without moving its advance, so two weights of the
 * same word measure the same width and differ only in what they paint.
 */
async function inkOf(
  fontFaceCss: string,
  samples: ReadonlyArray<{ readonly family: string; readonly text: string; readonly weight: number }>,
): Promise<number[]> {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss}</style></head><body></body></html>`,
    { waitUntil: 'load' });
  return page.evaluate(async ({ samples, size }) => {
    await Promise.all(samples.map((sample) => document.fonts.load(`${sample.weight} ${size}px ${sample.family}`, sample.text)));
    return samples.map((sample) => {
      const canvas = document.createElement('canvas');
      canvas.width = 2000;
      canvas.height = size * 3;
      const context = canvas.getContext('2d')!;
      context.font = `${sample.weight} ${size}px ${sample.family}`;
      context.textBaseline = 'top';
      context.fillText(sample.text, 10, size / 2);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let index = 3; index < data.length; index += 4) if (data[index]! > 128) ink++;
      return ink;
    });
  }, { samples: [...samples], size: FONT_SIZE_PX });
}

let faces: FontFaceDeclaration[];
let rawCss: string;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  metrics = new StubFontMetricsReader();
  faces = [...packageFaces('@fontsource/anton'), ...packageFaces('@fontsource/lalezar')];
  rawCss = faces.map((face) => new FontFaceCssWriter(new FontFaceSourceTrimmer()).write(face)).join('\n');
  await measureFaces(rawCss, [LATIN_FACE, ARABIC_FACE]);
});

afterAll(async () => { await browser.close(); });

function compile(leading: FontScript, present: ReadonlyArray<FontScript>) {
  return newCompiler(faces).compile({
    stack: stackOf(LATIN_FACE, ARABIC_FACE),
    scripts: new CaptionScripts(leading, new Set(present)),
    usedCodepoints: null,
  });
}

describe('a stack whose captions are written in one alphabet', () => {
  it('gives the line the same box the face gives it on its own', async () => {
    const compiled = compile('latin', ['latin']);
    const [asFace, asCompiled] = await boxesOf(
      `${rawCss}\n${compiled.css}`,
      [{ family: `'${LATIN_FACE}'`, text: LATIN_TEXT }, { family: `'${compiled.family}'`, text: LATIN_TEXT }],
    );
    expect(asCompiled!).toEqual(asFace!);
  });

  it('draws the punctuation a per-alphabet range would drop on the same face', async () => {
    const compiled = compile('latin', ['latin', 'arabic']);
    const [asFace, asCompiled] = await boxesOf(
      `${rawCss}\n${compiled.css}`,
      [
        { family: `'${LATIN_FACE}'`, text: PUNCTUATION_TEXT },
        { family: `'${compiled.family}'`, text: PUNCTUATION_TEXT },
      ],
    );
    expect(asCompiled!.width).toBe(asFace!.width);
  });
});

describe('a stack whose captions mix two alphabets', () => {
  it.each(['latin', 'arabic'] as const)('keeps both face choices when %s dominates', async (dominant) => {
    const compiled = compile(dominant, ['latin', 'arabic']);
    const [arabicFace, arabicCompiled, latinFace, latinCompiled] = await boxesOf(
      `${rawCss}\n${compiled.css}`,
      [
        { family: `'${ARABIC_FACE}'`, text: ARABIC_TEXT },
        { family: `'${compiled.family}'`, text: ARABIC_TEXT },
        { family: `'${LATIN_FACE}'`, text: LATIN_TEXT },
        { family: `'${compiled.family}'`, text: LATIN_TEXT },
      ],
    );
    expect(arabicCompiled!.width).toBe(arabicFace!.width);
    expect(latinCompiled!.width).toBe(latinFace!.width);
  });

  it('keeps its CSS family when only the dominant script changes', () => {
    expect(compile('latin', ['latin', 'arabic']).family)
      .toBe(compile('arabic', ['arabic', 'latin']).family);
  });

  it('keeps a template accent choice independent from the sheet font', async () => {
    const base = compile('arabic', ['latin', 'arabic']);
    const accent = newCompiler(faces).compile({
      stack: stackOf(ARABIC_FACE, ARABIC_FACE),
      scripts: new CaptionScripts('arabic', new Set(['latin', 'arabic'])),
      usedCodepoints: null,
    });
    const [plain, accented, reference] = await boxesOf(
      `${rawCss}\n${base.css}\n${accent.css}
      .line { --accent-font: '${accent.family}'; }
      .word.accent { font-family: var(--accent-font); }`,
      [
        { family: `'${base.family}'`, text: LATIN_TEXT },
        { family: `'${base.family}'`, text: `<span class="word accent">${LATIN_TEXT}</span>` },
        { family: `'${ARABIC_FACE}'`, text: LATIN_TEXT },
      ],
    );
    expect(accented!.width).toBe(reference!.width);
    expect(plain!.width).not.toBe(reference!.width);
  });

  it('gives a word the same box whichever alphabet it is written in', async () => {
    const compiled = compile('latin', ['latin', 'arabic']);
    const [latin, arabic] = await boxesOf(
      `${rawCss}\n${compiled.css}`,
      [
        { family: `'${compiled.family}'`, text: LATIN_TEXT },
        { family: `'${compiled.family}'`, text: ARABIC_TEXT },
      ],
    );
    expect(arabic!.height).toBe(latin!.height);
    expect(arabic!.baseline).toBe(latin!.baseline);
  });

  it('holds the glyphs of both faces inside that box', async () => {
    const compiled = compile('latin', ['latin', 'arabic']);
    const [latinAlone, arabicAlone, mixed] = await boxesOf(
      `${rawCss}\n${compiled.css}`,
      [
        { family: `'${LATIN_FACE}'`, text: LATIN_TEXT },
        { family: `'${ARABIC_FACE}'`, text: ARABIC_TEXT },
        { family: `'${compiled.family}'`, text: ARABIC_TEXT },
      ],
    );
    expect(mixed!.baseline).toBeGreaterThanOrEqual(Math.max(latinAlone!.baseline, arabicAlone!.baseline));
    expect(mixed!.height - mixed!.baseline).toBeGreaterThanOrEqual(
      Math.max(latinAlone!.height - latinAlone!.baseline, arabicAlone!.height - arabicAlone!.baseline),
    );
  });

  // The browser takes a line's box from the first face whose range
  // covers a space, and the engines disagree about which face that is.
  // One box for every face is what makes the disagreement unobservable.
  it('gives the same box whichever alphabet leads', async () => {
    const ledByLatin = compile('latin', ['latin', 'arabic']);
    const ledByArabic = compile('arabic', ['latin', 'arabic']);
    const [latinLed, arabicLed] = await boxesOf(
      `${ledByLatin.css}\n${ledByArabic.css}`,
      [
        { family: `'${ledByLatin.family}'`, text: ARABIC_TEXT },
        { family: `'${ledByArabic.family}'`, text: ARABIC_TEXT },
      ],
    );
    expect(arabicLed!.height).toBe(latinLed!.height);
    expect(arabicLed!.baseline).toBe(latinLed!.baseline);
  });
});


describe('fixed font-stack() references from Sass', () => {
  it.each(['latin', 'arabic'] as const)('renders its own faces when %s dominates', async (leading) => {
    const library = new FontStackLibrary();
    const registry = new TemplateFontStackRegistry(library);
    const authored = compileString(`@use 'font-stack' as *; .accent { font-family: font-stack('anton'); }`, {
      loadPaths: [resolve('../../templates/_lib')],
      functions: { 'tscaps-font-stack($id)': fontStackFunction(registry) },
    }).css;
    const scripts = new CaptionScripts(leading, new Set<FontScript>(['latin', 'arabic']));
    const compiled = newCompiler(faces).compile({ stack: library.stackFor('anton'), scripts, usedCodepoints: null });
    const vars = new FontStackCssVarsBuilder(
      library, new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver()),
    ).build(registry.declared(), scripts);
    const declarations = Object.entries(vars).map(([name, value]) => `${name}:${value}`).join(';');
    const [latin, latinReference, arabic, arabicReference] = await boxesOf(
      `${rawCss}\n${compiled.css}\n${authored}\n.line { ${declarations} }`,
      [
        { family: `'${ARABIC_FACE}'`, text: `<span class="accent">${LATIN_TEXT}</span>` },
        { family: `'${LATIN_FACE}'`, text: LATIN_TEXT },
        { family: `'${LATIN_FACE}'`, text: `<span class="accent">${ARABIC_TEXT}</span>` },
        { family: `'${ARABIC_FACE}'`, text: ARABIC_TEXT },
      ],
    );
    expect(latin!.width).toBe(latinReference!.width);
    expect(arabic!.width).toBe(arabicReference!.width);
  });
});


it('updates the Arabic sheet line box when an edit introduces hey without reapplying the template', async () => {
  const store = new EditorStore();
  const word = new Word({ text: ARABIC_TEXT, time: new TimeFragment(0, 1) });
  const segment = new Segment({ lines: [new Line({ words: [word] })] });
  const section = new Section({ kind: 'main', segments: [segment] });
  store.patch({ sheets: [new Sheet({ id: 'main' } as SheetProps)], document: new Document({ sections: [section] }) });
  const automation = new SheetScriptsAutomation(store,
    new SheetScriptsSynchronizer(new FontScriptClassifier(), new SheetCaptionTextCollector()));
  automation.start();
  const compiler = newCompiler(faces);
  const stack = stackOf(LATIN_FACE, ARABIC_FACE);
  const before = compiler.compile({ stack, scripts: store.snapshot().sheets[0]!.scripts, usedCodepoints: null });
  await boxesOf(`${rawCss}\n${before.css}`, [{ family: `'${before.family}'`, text: ARABIC_TEXT }]);

  const edited = new Document({ sections: [section.with({ segments: [segment.with({
    lines: [new Line({ words: [word, new Word({ text: LATIN_TEXT, time: new TimeFragment(1, 2) })] })],
  })] })] });
  store.patch({ document: edited });
  const after = compiler.compile({ stack, scripts: store.snapshot().sheets[0]!.scripts, usedCodepoints: null });
  expect(after.family).not.toBe(before.family);
  await page.addStyleTag({ content: after.css });
  await page.evaluate(({ family, arabic, latin }) => {
    const line = document.querySelector<HTMLElement>('.line')!;
    line.style.fontFamily = `'${family}'`;
    line.innerHTML = `<span class="word">${arabic}</span><span class="word">${latin}</span>`;
  }, { family: after.family, arabic: ARABIC_TEXT, latin: LATIN_TEXT });
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.evaluate(() => {
    const line = document.querySelector('.line')!.getBoundingClientRect();
    return [...document.querySelectorAll('.word')].map((word) => {
      const box = word.getBoundingClientRect();
      return { top: box.top - line.top, bottom: box.bottom - line.bottom, height: box.height };
    });
  });
  expect(bounds[0]!.height).toBe(bounds[1]!.height);
  for (const box of bounds) {
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(0);
  }
  automation.stop();
});


/**
 * A compiled family is several typefaces under one name, told apart by
 * coverage. The browser settles weight over the whole family before it
 * reads that coverage, so anything leaving two weights in the family
 * takes the alphabets of the losing side out of it — and they are then
 * drawn by whatever the list offers next, which reads as one alphabet
 * borrowing another's typeface.
 */
describe('a stack whose faces come from families of different weights', () => {
  const CYRILLIC_TEXT = 'Привет';
  const GREEK_TEXT = 'Γειά';
  const CYRILLIC_FACE = 'Montserrat Variable';
  const GREEK_FACE = 'Press Start 2P';
  // Ships a regular and a bold, which is what used to split the family.
  const DEVANAGARI_FACE = 'Poppins';

  it.each([400, 700])('draws each alphabet with its own face at weight %i', async (weight) => {
    const mixed = [
      ...packageFaces('@fontsource/anton'),
      ...packageFaces('@fontsource-variable/montserrat'),
      ...packageFaces('@fontsource/press-start-2p'),
      ...packageFaces('@fontsource/poppins', '400.css'),
      ...packageFaces('@fontsource/poppins', '700.css'),
    ];
    const writer = new FontFaceCssWriter(new FontFaceSourceTrimmer());
    const mixedRawCss = mixed.map((face) => writer.write(face)).join('\n');
    await measureFaces(mixedRawCss, [LATIN_FACE, CYRILLIC_FACE, GREEK_FACE, DEVANAGARI_FACE]);
    const compiled = newCompiler(mixed).compile({
      stack: FontStack.of({
        latin: LATIN_FACE, arabic: LATIN_FACE, urdu: LATIN_FACE, hebrew: LATIN_FACE,
        cyrillic: CYRILLIC_FACE, greek: GREEK_FACE, devanagari: DEVANAGARI_FACE,
        bengali: LATIN_FACE, telugu: LATIN_FACE, tamil: LATIN_FACE, thai: LATIN_FACE,
      }),
      scripts: new CaptionScripts('latin', new Set<FontScript>(['latin', 'cyrillic', 'greek', 'devanagari'])),
      usedCodepoints: null,
    });

    const samples = [
      { text: LATIN_TEXT, face: LATIN_FACE },
      { text: CYRILLIC_TEXT, face: CYRILLIC_FACE },
      { text: GREEK_TEXT, face: GREEK_FACE },
    ];
    const boxes = await boxesOf(
      `${mixedRawCss}\n${compiled.css}`,
      samples.flatMap((sample) => [
        { family: `'${compiled.family}'`, text: sample.text, weight },
        { family: `'${sample.face}'`, text: sample.text, weight },
      ]),
    );
    for (const [index, sample] of samples.entries()) {
      expect(
        { text: sample.text, width: boxes[index * 2]!.width },
        `${sample.text} should be drawn by ${sample.face}`,
      ).toEqual({ text: sample.text, width: boxes[index * 2 + 1]!.width });
    }
  });
});


/**
 * The collapser leaves the two styles of a family standing where it
 * takes its weights down to one, on the reading that the browser
 * settles style before weight and a second style therefore narrows the
 * family rather than splitting it. Weight was reasoned the same way and
 * behaved otherwise, so this is the reading measured rather than
 * trusted, in both styles and with a face that has no italic of its own.
 */
describe('a stack whose faces disagree about having an italic', () => {
  const ROMAN_AND_ITALIC_FACE = 'EB Garamond Variable';
  const ROMAN_ONLY_FACE = 'Press Start 2P';
  const GREEK_TEXT = 'Γειά';

  it.each(['normal', 'italic'] as const)('draws each alphabet with its own face in %s', async (style) => {
    const mixed = [
      ...packageFaces('@fontsource-variable/eb-garamond'),
      ...packageFaces('@fontsource-variable/eb-garamond', 'wght-italic.css'),
      ...packageFaces('@fontsource/press-start-2p'),
    ];
    const writer = new FontFaceCssWriter(new FontFaceSourceTrimmer());
    const mixedRawCss = mixed.map((face) => writer.write(face)).join('\n');
    await measureFaces(mixedRawCss, [ROMAN_AND_ITALIC_FACE, ROMAN_ONLY_FACE]);
    const compiled = newCompiler(mixed).compile({
      stack: FontStack.of({
        latin: ROMAN_AND_ITALIC_FACE, arabic: ROMAN_AND_ITALIC_FACE, urdu: ROMAN_AND_ITALIC_FACE,
        hebrew: ROMAN_AND_ITALIC_FACE, cyrillic: ROMAN_AND_ITALIC_FACE, devanagari: ROMAN_AND_ITALIC_FACE,
        greek: ROMAN_ONLY_FACE, bengali: ROMAN_AND_ITALIC_FACE, telugu: ROMAN_AND_ITALIC_FACE,
        tamil: ROMAN_AND_ITALIC_FACE, thai: ROMAN_AND_ITALIC_FACE,
      }),
      scripts: new CaptionScripts('latin', new Set<FontScript>(['latin', 'greek'])),
      usedCodepoints: null,
    });

    const samples = [
      { text: LATIN_TEXT, face: ROMAN_AND_ITALIC_FACE },
      { text: GREEK_TEXT, face: ROMAN_ONLY_FACE },
    ];
    const boxes = await boxesOf(
      `${mixedRawCss}\n${compiled.css}`,
      samples.flatMap((sample) => [
        { family: `'${compiled.family}'`, text: sample.text, style },
        { family: `'${sample.face}'`, text: sample.text, style },
      ]),
    );
    for (const [index, sample] of samples.entries()) {
      expect(
        { text: sample.text, width: boxes[index * 2]!.width },
        `${sample.text} should be drawn by ${sample.face}`,
      ).toEqual({ text: sample.text, width: boxes[index * 2 + 1]!.width });
    }
  });
});


/**
 * The weight every face of the family declares decides whether it can
 * be drawn bold at all. A face whose declared range contains the
 * requested weight is one the browser reads as already being that
 * weight, so it neither reaches for a heavier file nor synthesizes one:
 * declaring the whole axis over faces that all ship a single weight
 * leaves the family with no bold whatsoever.
 */
describe('a compiled family asked for a weight none of its faces ships', () => {
  const GREEK_TEXT = 'Γειά';
  const GREEK_FACE = 'Press Start 2P';

  it('draws each alphabet heavier than it draws it regular', async () => {
    const mixed = [...packageFaces('@fontsource/anton'), ...packageFaces('@fontsource/press-start-2p')];
    const writer = new FontFaceCssWriter(new FontFaceSourceTrimmer());
    const mixedRawCss = mixed.map((face) => writer.write(face)).join('\n');
    await measureFaces(mixedRawCss, [LATIN_FACE, GREEK_FACE]);
    const compiled = newCompiler(mixed).compile({
      stack: FontStack.of({
        latin: LATIN_FACE, arabic: LATIN_FACE, urdu: LATIN_FACE, hebrew: LATIN_FACE,
        cyrillic: LATIN_FACE, devanagari: LATIN_FACE, greek: GREEK_FACE,
        bengali: LATIN_FACE, telugu: LATIN_FACE, tamil: LATIN_FACE, thai: LATIN_FACE,
      }),
      scripts: new CaptionScripts('latin', new Set<FontScript>(['latin', 'greek'])),
      usedCodepoints: null,
    });

    const samples = [LATIN_TEXT, GREEK_TEXT];
    const ink = await inkOf(
      `${mixedRawCss}\n${compiled.css}`,
      samples.flatMap((text) => [400, 700].map((weight) => ({ family: `'${compiled.family}'`, text, weight }))),
    );
    for (const [index, text] of samples.entries()) {
      expect(ink[index * 2 + 1]!, `${text} at 700 should cover more ink than at 400`)
        .toBeGreaterThan(ink[index * 2]!);
    }
  });
});


/**
 * Faces that already answer the same weights are left answering them,
 * so a family whose faces all ship a regular and a bold keeps its own
 * bold files rather than being cut down to the regular and thickened.
 */
describe('a compiled family whose faces all ship a regular and a bold', () => {
  const BOLD_LATIN_FACE = 'Poppins';
  const BOLD_ARABIC_FACE = 'Amiri';

  it('draws each alphabet with its own face at both weights', async () => {
    const mixed = [
      ...packageFaces('@fontsource/poppins', '400.css'), ...packageFaces('@fontsource/poppins', '700.css'),
      ...packageFaces('@fontsource/amiri', '400.css'), ...packageFaces('@fontsource/amiri', '700.css'),
    ];
    const writer = new FontFaceCssWriter(new FontFaceSourceTrimmer());
    const mixedRawCss = mixed.map((face) => writer.write(face)).join('\n');
    await measureFaces(mixedRawCss, [BOLD_LATIN_FACE, BOLD_ARABIC_FACE]);
    const compiled = newCompiler(mixed).compile({
      stack: FontStack.of({
        latin: BOLD_LATIN_FACE, cyrillic: BOLD_LATIN_FACE, greek: BOLD_LATIN_FACE,
        devanagari: BOLD_LATIN_FACE, hebrew: BOLD_LATIN_FACE,
        arabic: BOLD_ARABIC_FACE, urdu: BOLD_ARABIC_FACE,
        bengali: BOLD_LATIN_FACE, telugu: BOLD_LATIN_FACE,
        tamil: BOLD_LATIN_FACE, thai: BOLD_LATIN_FACE,
      }),
      scripts: new CaptionScripts('latin', new Set<FontScript>(['latin', 'arabic'])),
      usedCodepoints: null,
    });

    const samples = [
      { text: LATIN_TEXT, face: BOLD_LATIN_FACE },
      { text: ARABIC_TEXT, face: BOLD_ARABIC_FACE },
    ];
    for (const weight of [400, 700]) {
      const ink = await inkOf(
        `${mixedRawCss}\n${compiled.css}`,
        samples.flatMap((sample) => [
          { family: `'${compiled.family}'`, text: sample.text, weight },
          { family: `'${sample.face}'`, text: sample.text, weight },
        ]),
      );
      for (const [index, sample] of samples.entries()) {
        expect(ink[index * 2]!, `${sample.text} at ${weight} should be drawn by ${sample.face}`)
          .toBe(ink[index * 2 + 1]!);
      }
    }
  });
});
