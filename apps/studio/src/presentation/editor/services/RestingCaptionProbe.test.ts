import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import {
  BaselineCssComposer,
  CssBlockSealer,
  CssFragmentParser,
  CssKeyframeNamespacer,
  CssLayer,
  CssMinifier,
  CssScoper,
  FROZEN_FRAME_CSS,
  SvgFilterDefinitionsParser,
  TagConditionParser,
} from '@tscaps/engine';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { BuiltinAssetRepositoryBuilder } from '@core/assets/infrastructure/BuiltinAssetRepositoryBuilder';
import { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { FontWeightField } from '@core/elements/domain/fields/FontWeightField';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { BuiltinTemplateAssetsBuilder } from '@core/templates/infrastructure/BuiltinTemplateAssetsBuilder';
import { LocalFileTemplateLoader } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import { BoxEdgesShorthandParser } from '@core/templates/services/BoxEdgesShorthandParser';
import { CssAssetReferenceResolver } from '@core/templates/services/CssAssetReferenceResolver';
import { StyleControlResolver } from '@core/templates/services/controls/StyleControlResolver';
import { bootRendering } from '@bootstrap/wiring/rendering';
import { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';

/**
 * What a word's fields open on, asked of the browser that paints it.
 *
 * A word left alone looks the way everything around it decides: the
 * template and the rules it keeps for the word's tags, the sheet's own
 * edits, what the caption was given, CSS written by hand on any element.
 * The fields used to answer from the sheet's typography alone, so a word
 * a template makes bold for being emphasised opened on the plain weight.
 * Only a CSS engine knows how all of that resolves, so these tests lay
 * the real compiled templates out in Chromium, under the same layered,
 * scoped stylesheet the overlay writes, and read through the real probe
 * and the real field reader.
 *
 * Nothing in the page is painted as a caption: the probe builds its own
 * copy from the document, which is why a word off screen reads the same.
 */

const FIXTURE_ID = 'virtual:resting-caption-probe-fixture';
// The probe as the editor wires it: the render's own markup, and the
// fields a word offers, from which the properties to collect come.
const FIXTURE_SOURCE = `
  import { BidiJsAnalyzer } from '@modules/bidi/BidiJsAnalyzer';
  import { BidiJsCharacterClassifier } from '@modules/bidi/BidiJsCharacterClassifier';
  import { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
  import { LineBaseDirectionResolver } from '@modules/bidi/LineBaseDirectionResolver';
  import { WordFragmenter } from '@modules/bidi/WordFragmenter';
  import { SegmentProbeMarkupBuilder } from '@modules/rendering/subtitle/SegmentProbeMarkupBuilder';
  import { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
  import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
  import { FontFamilyField } from '@core/elements/domain/fields/FontFamilyField';
  import { FontSizeField } from '@core/elements/domain/fields/FontSizeField';
  import { FontWeightField } from '@core/elements/domain/fields/FontWeightField';
  import { ItalicField } from '@core/elements/domain/fields/ItalicField';
  import { RelativeSizeField } from '@core/elements/domain/fields/RelativeSizeField';
  import { RotationField } from '@core/elements/domain/fields/RotationField';
  import { StrikethroughField } from '@core/elements/domain/fields/StrikethroughField';
  import { TextColorField } from '@core/elements/domain/fields/TextColorField';
  import { UnderlineField } from '@core/elements/domain/fields/UnderlineField';
  import { WordElementType } from '@core/elements/domain/types/WordElementType';
  export { RestingCaptionProbe } from '@presentation/editor/services/RestingCaptionProbe';
  export { RestingStyleFieldReader } from '@presentation/editor/services/RestingStyleFieldReader';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { Tag } from '@modules/tags/Tag';
  export { TimeFragment } from '@modules/document/TimeFragment';
  export { Section } from '@modules/document/Section';
  export { Document } from '@modules/document/Document';
  export { RestingElementStyle } from '@presentation/editor/services/RestingElementStyle';
  export { StructureTagger } from '@modules/tagging/StructureTagger';
  export const markup = new SegmentProbeMarkupBuilder(
    new GraphemeWordSplitter(),
    new WordFragmenter(new BidiJsAnalyzer(), new CursiveScriptDetector(), new LineBaseDirectionResolver(new BidiJsCharacterClassifier()), new BidiJsCharacterClassifier()),
  );
  export const wordFields = new WordElementType(new ElementFieldLibrary([
    new ItalicField(), new UnderlineField(), new StrikethroughField(), new FontFamilyField(), new FontSizeField(),
    new RelativeSizeField(), new FontWeightField(), new TextColorField(), new RotationField(),
  ])).fields();
`;

const STUDIO = resolve(import.meta.dirname, '../../../..');
const SCOPE_CLASS = 'tscaps-sheet-probe';
const STAGE = { width: 1080, height: 1920 };

/** The variables a sheet left at its template's defaults declares on the wrapper. */
const MIRA_SHEET_VARS = { '--tscaps-font-weight': '600', '--tscaps-primary-color': '#ffffff' };
const KEL_SHEET_VARS = { '--tscaps-primary-color': '#d4d4d4', '--tscaps-upcoming-color': '#808080' };

interface WordSpec {
  readonly id: string;
  readonly text: string;
  readonly tags?: ReadonlyArray<string>;
  readonly structure?: ReadonlyArray<string>;
}

interface Reading {
  readonly css: string;
  readonly wrapperStyles: Readonly<Record<string, string>>;
  readonly lines: ReadonlyArray<ReadonlyArray<WordSpec>>;
  readonly wordId: string;
  /** Whether the template paints a word one letter at a time. */
  readonly splitWordsIntoLetters?: boolean;
  /** Words the overlay paints alone, out of their line. */
  readonly positionedWordIds?: ReadonlyArray<string>;
  /** Classes the overlay puts on the caption's segment for its state. */
  readonly segmentStateClasses?: ReadonlyArray<string>;
  /** Whether the overlay paints a video frame layer first inside the caption. */
  readonly includeVideoFrameLayer?: boolean;
}

type FieldValues = Readonly<Record<ElementFieldId, string | number | null>>;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'resting-caption-probe-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: {
      alias: {
        '@tscaps/engine': resolve(STUDIO, '../../packages/engine/src/index.ts'),
        '@modules': resolve(STUDIO, '../../packages/engine/src/modules'),
        '@core': resolve(STUDIO, 'src/core'),
        '@presentation': resolve(STUDIO, 'src/presentation'),
      },
    },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'fixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}

function templateCss(name: string): string {
  return readFileSync(resolve(STUDIO, `../../templates/${name}/style.build.css`), 'utf8');
}

/** The stylesheet the overlay writes for a sheet: its framework rules, then the layered caption CSS, scoped. */
function overlayStylesheet(sheetCss: string, styles: ElementStyles = ElementStyles.empty()): string {
  const scoper = new CssScoper();
  const minifier = new CssMinifier();
  const layered = new LayeredCaptionCssBuilder(new CssKeyframeNamespacer(), minifier, new CssBlockSealer())
    .build(minifier.minify(sheetCss), SheetAnimationSet.empty(), styles);
  return [
    new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true, isolation: true }),
    `@layer ${CssLayer.FRAMEWORK} {\n${scoper.scope(FROZEN_FRAME_CSS, `.${SCOPE_CLASS}`)}\n}`,
    scoper.scope(layered, `.${SCOPE_CLASS}`),
  ].join('\n');
}

/** A caption's segment given a weight of its own through its field, as the panel writes it. */
function captionWeighing(weight: number): ElementStyles {
  const control = new FontWeightField().controlFor('wrapper');
  const css = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())).write('', control, weight);
  return ElementStyles.empty().withField('s0', 'segment', control.id, weight, css);
}

async function pageUnder(css: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(
    `<style>${css}</style>`
    + `<div id="scaler" style="position: relative; container-type: size; width: ${STAGE.width}px; height: ${STAGE.height}px;"></div>`,
  );
  await page.addScriptTag({ content: bundle });
  return page;
}

/** Every field's value for `reading.wordId`, as the probe and the reader resolve it; `null` for a field that reads nothing back. */
async function fieldsOf(reading: Reading): Promise<FieldValues> {
  const page = await pageUnder(reading.css);
  try {
    return await page.evaluate(({
      lines, wordId, wrapperStyles, scopeClass, splitWordsIntoLetters, positionedWordIds, segmentStateClasses, includeVideoFrameLayer,
    }) => {
      // The bundle is untyped from here; the shapes below are the ones it exports.
      const f = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
        RestingCaptionProbe: new (host: unknown, source: unknown, markup: unknown) => {
          read: (document: unknown, sheet: unknown, wordId: string, properties: ReadonlyArray<string>) => unknown;
        };
        RestingStyleFieldReader: new () => {
          propertiesFor: (fields: unknown) => ReadonlyArray<string>;
          read: (control: unknown, style: unknown) => string | number | undefined;
        };
        markup: unknown;
        wordFields: ReadonlyArray<{ id: string; controlFor: (surface: 'text') => unknown }>;
        Segment: new (props: unknown) => unknown;
        Line: new (props: unknown) => unknown;
        Word: new (props: unknown) => unknown;
        Tag: { of: (name: string) => unknown };
        TimeFragment: new (start: number, end: number) => unknown;
      };
      let clock = 0;
      const segment = new f.Segment({
        id: 's0',
        lines: lines.map((words, lineIndex) => new f.Line({
          id: `l${lineIndex}`,
          words: words.map((word) => new f.Word({
            id: word.id,
            text: word.text,
            time: new f.TimeFragment(clock, ++clock),
            semanticTags: new Set((word.tags ?? []).map((name) => f.Tag.of(name))),
            structureTags: new Set((word.structure ?? []).map((name) => f.Tag.of(name))),
          })),
        })),
      });
      const host = { scaler: () => document.getElementById('scaler'), isSessionActive: () => false, subscribe: () => () => {} };
      const source = {
        captionOf: () => ({
          segment,
          segmentIndex: 0,
          scopeClass,
          wrapperStyles,
          textDirection: 'ltr',
          splitWordsIntoLetters,
          includeVideoFrameLayer,
          segmentStateClasses,
          positionedWordIds: new Set(positionedWordIds),
        }),
      };
      const probe = new f.RestingCaptionProbe(host, source, f.markup);
      const reader = new f.RestingStyleFieldReader();
      const resting = probe.read({}, {}, wordId, reader.propertiesFor(f.wordFields));
      if (resting === null) throw new Error('The probe read nothing.');
      return Object.fromEntries(f.wordFields.map((field) => [field.id, reader.read(field.controlFor('text'), resting) ?? null]));
    }, {
      lines: reading.lines,
      wordId: reading.wordId,
      wrapperStyles: reading.wrapperStyles,
      scopeClass: SCOPE_CLASS,
      splitWordsIntoLetters: reading.splitWordsIntoLetters ?? false,
      positionedWordIds: reading.positionedWordIds ?? [],
      segmentStateClasses: reading.segmentStateClasses ?? [],
      includeVideoFrameLayer: reading.includeVideoFrameLayer ?? false,
    }) as FieldValues;
  } finally {
    await page.close();
  }
}

const ONE_LINE: ReadonlyArray<ReadonlyArray<WordSpec>> = [[
  { id: 'w0', text: 'this' },
  { id: 'w1', text: 'is' },
  { id: 'w2', text: 'unbelievable', tags: ['emphasis'] },
]];

describe('a word in a template that weighs its tags', () => {
  it('opens on the weight the template gives the tag, not the sheet\'s', async () => {
    const css = overlayStylesheet(templateCss('mira'));
    const tagged = await fieldsOf({ css, wrapperStyles: MIRA_SHEET_VARS, lines: ONE_LINE, wordId: 'w2' });
    const plain = await fieldsOf({ css, wrapperStyles: MIRA_SHEET_VARS, lines: ONE_LINE, wordId: 'w0' });

    expect(tagged[ElementFieldId.FONT_WEIGHT]).toBe(900);
    expect(plain[ElementFieldId.FONT_WEIGHT]).toBe(600);
  });

  it('follows the control the sheet moves that weight with', async () => {
    const values = await fieldsOf({
      css: overlayStylesheet(templateCss('mira')),
      wrapperStyles: { ...MIRA_SHEET_VARS, '--tscaps-tag-weight': '700' },
      lines: ONE_LINE,
      wordId: 'w2',
    });

    expect(values[ElementFieldId.FONT_WEIGHT]).toBe(700);
  });

  it('keeps the tag\'s weight over one given to its caption, as the template paints it', async () => {
    const css = overlayStylesheet(templateCss('mira'), captionWeighing(400));
    const tagged = await fieldsOf({ css, wrapperStyles: MIRA_SHEET_VARS, lines: ONE_LINE, wordId: 'w2' });
    const plain = await fieldsOf({ css, wrapperStyles: MIRA_SHEET_VARS, lines: ONE_LINE, wordId: 'w0' });

    expect(tagged[ElementFieldId.FONT_WEIGHT]).toBe(900);
    expect(plain[ElementFieldId.FONT_WEIGHT]).toBe(400);
  });
});

describe('every layer of the stylesheet reaches the word', () => {
  it('CSS written by hand on the word itself', async () => {
    const styles = ElementStyles.empty().withCss('w2', 'word', 'font-weight: 300; font-style: italic;');
    const values = await fieldsOf({
      css: overlayStylesheet(templateCss('mira'), styles),
      wrapperStyles: MIRA_SHEET_VARS,
      lines: ONE_LINE,
      wordId: 'w2',
    });

    expect(values[ElementFieldId.FONT_WEIGHT]).toBe(300);
    expect(values[ElementFieldId.ITALIC]).toBe('italic');
  });

  it('CSS written by hand on the caption around it', async () => {
    const styles = ElementStyles.empty().withCss('s0', 'segment', 'color: #ff0000;');
    const values = await fieldsOf({
      css: overlayStylesheet(templateCss('mira'), styles),
      wrapperStyles: MIRA_SHEET_VARS,
      lines: ONE_LINE,
      wordId: 'w0',
    });

    expect(values[ElementFieldId.PRIMARY_COLOR]).toBe('#ff0000');
  });

  it('the sheet\'s own edit of the template\'s CSS', async () => {
    const edited = `${templateCss('mira')}
      .emphasis {
        color: rgba(0, 255, 0, 0.5);
        text-decoration-line: underline line-through;
        rotate: -4deg;
        font-size: 1.5em;
      }`;
    const values = await fieldsOf({
      css: overlayStylesheet(edited),
      wrapperStyles: MIRA_SHEET_VARS,
      lines: ONE_LINE,
      wordId: 'w2',
    });

    expect(values[ElementFieldId.PRIMARY_COLOR]).toBe('#00ff0080');
    expect(values[ElementFieldId.UNDERLINE]).toBe('underline');
    expect(values[ElementFieldId.STRIKETHROUGH]).toBe('line-through');
    expect(values[ElementFieldId.ROTATION]).toBe(-4);
    expect(values[ElementFieldId.RELATIVE_SIZE]).toBe(150);
  });
});

describe('a word at rest', () => {
  it('reads the colour a karaoke template paints a word already said, wherever it sits', async () => {
    const css = overlayStylesheet(templateCss('kel'));
    const colors = await Promise.all(['w0', 'w1', 'w2'].map(async (wordId) => {
      const values = await fieldsOf({ css, wrapperStyles: KEL_SHEET_VARS, lines: ONE_LINE, wordId });
      return values[ElementFieldId.PRIMARY_COLOR];
    }));

    expect(colors).toEqual(['#d4d4d4', '#d4d4d4', '#d4d4d4']);
  });

  it('is not caught partway through an animation', async () => {
    const animated = `${templateCss('mira')}
      @keyframes flash { from, to { color: #ff00ff; font-weight: 100; } }
      .word { animation: flash 1s var(--on-word-being-narrated-starts) both; }`;
    const values = await fieldsOf({
      css: overlayStylesheet(animated),
      wrapperStyles: MIRA_SHEET_VARS,
      lines: ONE_LINE,
      wordId: 'w0',
    });

    expect(values[ElementFieldId.PRIMARY_COLOR]).toBe('#ffffff');
    expect(values[ElementFieldId.FONT_WEIGHT]).toBe(600);
  });
});

describe('a word a template styles by where it sits', () => {
  // luca draws the first word of a three-word second line big, in its own face.
  const TWO_LINES: ReadonlyArray<ReadonlyArray<WordSpec>> = [
    [{ id: 'a0', text: 'we', structure: ['first-word-in-line'] }, { id: 'a1', text: 'were' }],
    [
      { id: 'b0', text: 'done', structure: ['first-word-in-line'] },
      { id: 'b1', text: 'with' },
      { id: 'b2', text: 'it' },
    ],
  ];

  it('reads the place it holds in its caption', async () => {
    const css = overlayStylesheet(templateCss('luca'));
    const big = await fieldsOf({ css, wrapperStyles: {}, lines: TWO_LINES, wordId: 'b0' });
    const beside = await fieldsOf({ css, wrapperStyles: {}, lines: TWO_LINES, wordId: 'b1' });

    expect(big[ElementFieldId.RELATIVE_SIZE]).toBe(260);
    expect(big[ElementFieldId.FONT_WEIGHT]).toBe(400);
    expect(beside[ElementFieldId.RELATIVE_SIZE]).toBe(100);
  });

  it('never reads a font back, since a family list is not a stack', async () => {
    const big = await fieldsOf({ css: overlayStylesheet(templateCss('luca')), wrapperStyles: {}, lines: TWO_LINES, wordId: 'b0' });

    expect(big[ElementFieldId.FONT_FAMILY]).toBeNull();
  });
});

describe('a word a template paints one letter at a time', () => {
  it('reads the word, not one of its letters', async () => {
    const values = await fieldsOf({
      css: overlayStylesheet(templateCss('pico')),
      wrapperStyles: {},
      lines: ONE_LINE,
      wordId: 'w2',
      splitWordsIntoLetters: true,
    });

    expect(values[ElementFieldId.FONT_WEIGHT]).toBe(900);
  });
});

describe('a colour the browser computes but nobody sees as one', () => {
  it('opens on nothing for a word a template draws with a gradient clipped to its letters', async () => {
    // nina leaves `color` transparent and paints the letters through
    // `background-clip: text`: a picker opened on that would hold an
    // opacity of zero, and every colour picked from it would stay unseen.
    const values = await fieldsOf({ css: overlayStylesheet(templateCss('nina')), wrapperStyles: {}, lines: ONE_LINE, wordId: 'w0' });

    expect(values[ElementFieldId.PRIMARY_COLOR]).toBeNull();
  });

  it('reads a colour mixed in sRGB as the colour painted', async () => {
    // ziggy mixes 22% of its tube colour, #ff2fa8 by default, into white.
    const values = await fieldsOf({ css: overlayStylesheet(templateCss('ziggy')), wrapperStyles: {}, lines: ONE_LINE, wordId: 'w0' });

    expect(values[ElementFieldId.PRIMARY_COLOR]).toBe('#ffd1ec');
  });
});

describe('a word placed out of its line', () => {
  // nova draws its first line in the highlight colour and every line
  // after it in the main one.
  const TWO_LINES: ReadonlyArray<ReadonlyArray<WordSpec>> = [
    [{ id: 'a0', text: 'one' }, { id: 'a1', text: 'two' }],
    [{ id: 'b0', text: 'three' }, { id: 'b1', text: 'four' }, { id: 'b2', text: 'five' }],
  ];

  it('reads the look it is painted in alone, not the one it had in its line', async () => {
    const css = overlayStylesheet(templateCss('nova'));
    const placed = await fieldsOf({ css, wrapperStyles: {}, lines: TWO_LINES, wordId: 'b1', positionedWordIds: ['b1'] });
    const inLine = await fieldsOf({ css, wrapperStyles: {}, lines: TWO_LINES, wordId: 'b1' });

    expect(placed[ElementFieldId.PRIMARY_COLOR]).toBe('#ffea00');
    expect(inLine[ElementFieldId.PRIMARY_COLOR]).toBe('#ffffff');
  });

  it('leaves its line with the gap the overlay leaves', async () => {
    const edited = `${templateCss('mira')}
      .line > .word:nth-child(2) { font-weight: 100; }`;
    const values = await fieldsOf({
      css: overlayStylesheet(edited),
      wrapperStyles: MIRA_SHEET_VARS,
      lines: ONE_LINE,
      wordId: 'w2',
      positionedWordIds: ['w1'],
    });

    expect(values[ElementFieldId.FONT_WEIGHT]).toBe(100);
  });
});

describe('a caption in the state the overlay paints it in', () => {
  it('reads the weight a template gives a caption behind the actor', async () => {
    // pastor sets a caption behind the actor in its poster face at 400.
    const css = overlayStylesheet(templateCss('pastor'));
    const behind = await fieldsOf({ css, wrapperStyles: {}, lines: ONE_LINE, wordId: 'w0', segmentStateClasses: ['behind-actor-active'] });
    const inFront = await fieldsOf({ css, wrapperStyles: {}, lines: ONE_LINE, wordId: 'w0' });

    expect(behind[ElementFieldId.FONT_WEIGHT]).toBe(400);
    expect(inFront[ElementFieldId.FONT_WEIGHT]).toBe(500);
  });

  it('keeps the state off a word placed at its own anchor, as the overlay does', async () => {
    const values = await fieldsOf({
      css: overlayStylesheet(templateCss('pastor')),
      wrapperStyles: {},
      lines: ONE_LINE,
      wordId: 'w0',
      segmentStateClasses: ['behind-actor-active'],
      positionedWordIds: ['w0'],
    });

    expect(values[ElementFieldId.FONT_WEIGHT]).toBe(500);
  });

  it('carries the video frame layer the preview paints first inside the caption', async () => {
    const edited = `${templateCss('mira')}
      .line:first-child > .word { font-weight: 100; }`;
    const css = overlayStylesheet(edited);
    const withLayer = await fieldsOf({ css, wrapperStyles: MIRA_SHEET_VARS, lines: ONE_LINE, wordId: 'w0', includeVideoFrameLayer: true });
    const withoutLayer = await fieldsOf({ css, wrapperStyles: MIRA_SHEET_VARS, lines: ONE_LINE, wordId: 'w0' });

    expect(withLayer[ElementFieldId.FONT_WEIGHT]).toBe(600);
    expect(withoutLayer[ElementFieldId.FONT_WEIGHT]).toBe(100);
  });
});

describe('the probe itself', () => {
  it('leaves the box it mounted in as it found it', async () => {
    const page = await pageUnder(overlayStylesheet(templateCss('mira')));
    try {
      const childrenAfter = await page.evaluate(() => {
        const f = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
          RestingCaptionProbe: new (host: unknown, source: unknown, markup: unknown) => {
            read: (document: unknown, sheet: unknown, wordId: string, properties: ReadonlyArray<string>) => unknown;
          };
          markup: unknown;
          Segment: new (props: unknown) => unknown;
          Line: new (props: unknown) => unknown;
          Word: new (props: unknown) => unknown;
          TimeFragment: new (start: number, end: number) => unknown;
        };
        const segment = new f.Segment({
          id: 's0',
          lines: [new f.Line({ id: 'l0', words: [new f.Word({ id: 'w0', text: 'hello', time: new f.TimeFragment(0, 1) })] })],
        });
        const scaler = document.getElementById('scaler')!;
        const probe = new f.RestingCaptionProbe(
          { scaler: () => scaler, isSessionActive: () => false, subscribe: () => () => {} },
          {
            captionOf: () => ({
              segment,
              segmentIndex: 0,
              scopeClass: 'tscaps-sheet-probe',
              wrapperStyles: {},
              textDirection: 'ltr',
              splitWordsIntoLetters: false,
              includeVideoFrameLayer: false,
              segmentStateClasses: [],
              positionedWordIds: new Set(),
            }),
          },
          f.markup,
        );
        probe.read({}, {}, 'w0', ['font-weight']);
        return scaler.childElementCount;
      });

      expect(childrenAfter).toBe(0);
    } finally {
      await page.close();
    }
  });

  it('reads nothing while there is no box to mount in', async () => {
    const page = await pageUnder('');
    try {
      const reading = await page.evaluate(() => {
        const f = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
          RestingCaptionProbe: new (host: unknown, source: unknown, markup: unknown) => {
            read: (document: unknown, sheet: unknown, wordId: string, properties: ReadonlyArray<string>) => unknown;
          };
          markup: unknown;
        };
        const probe = new f.RestingCaptionProbe(
          { scaler: () => null, isSessionActive: () => false, subscribe: () => () => {} },
          { captionOf: () => { throw new Error('A caption was looked for with nowhere to mount it.'); } },
          f.markup,
        );
        return probe.read({}, {}, 'w0', ['font-weight']);
      });

      expect(reading).toBeNull();
    } finally {
      await page.close();
    }
  });
});

// ─── The still copy against the caption it stands for, in every template ───

const TEMPLATES_DIR = resolve(STUDIO, '../../templates');

/** One built template, dressed into a sheet left at its defaults, as the overlay would paint it. */
interface TemplateAtRest {
  readonly css: string;
  readonly scopeClass: string;
  readonly wrapperStyles: Readonly<Record<string, string>>;
  readonly splitWordsIntoLetters: boolean;
  readonly includeVideoFrameLayer: boolean;
}

function builtTemplateNames(): string[] {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter((entry) => existsSync(join(TEMPLATES_DIR, entry.name, 'style.build.css')))
    .map((entry) => entry.name)
    .sort();
}

function readJsonIfPresent(path: string): unknown {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

// Read from disk rather than through the editor's `import.meta.glob`,
// which hands a test CSS imported as raw text back empty. The filters are
// left out: parsing them needs a DOMParser Node lacks, and they feed only
// `filter:` URLs, which no word field reads.
function templateLoader(): LocalFileTemplateLoader {
  const css: Record<string, string> = {};
  const configs: Record<string, unknown> = {};
  const controls: Record<string, unknown> = {};
  const animations: Record<string, unknown> = {};
  const fonts: Record<string, unknown> = {};
  for (const name of builtTemplateNames()) {
    const dir = join(TEMPLATES_DIR, name);
    const key = (file: string): string => `/templates/${name}/${file}`;
    css[key('style.build.css')] = readFileSync(join(dir, 'style.build.css'), 'utf8');
    configs[key('template.json')] = readJsonIfPresent(join(dir, 'template.json'));
    for (const [file, into] of [['controls.build.json', controls], ['animations.build.json', animations], ['fonts.build.json', fonts]] as const) {
      const value = readJsonIfPresent(join(dir, file));
      if (value !== undefined) into[key(file)] = value;
    }
  }
  const assets = Object.fromEntries(readdirSync(join(TEMPLATES_DIR, '_assets'))
    .map((file) => [`/templates/_assets/${file}`, `/assets/${file}`]));
  const library = new FontStackLibrary();
  const tags = new TagConditionParser();
  return new LocalFileTemplateLoader(
    new BuiltinTemplateAssetsBuilder(css, configs, {}, controls, animations, fonts).build(),
    new CssAssetReferenceResolver(new BuiltinAssetRepositoryBuilder(assets).build()),
    new SegmentSplitterRegistry(),
    new LineSplitterRegistry(tags),
    new EffectRegistry(),
    new SvgFilterDefinitionsParser(),
    new BoxEdgesShorthandParser(),
    tags,
    new StyleControlResolver(new StyleControlCatalog(new SimilarNameFinder()), library),
    library,
    new CalendarDateParser(),
  );
}

describe('the still copy stands for the caption it is taken from, at rest', () => {
  const loader = templateLoader();
  const rendering = bootRendering({
    assetLibrary: { repository: new BuiltinAssetRepositoryBuilder({}).build() } as never,
    fontFaceCssReader: {} as never,
    fontMetricsReader: {} as never,
  });
  const artifacts = new SheetOverlayArtifactsBuilder(
    rendering.sheetCssVarsBuilder,
    rendering.svgFilterDefinitionsResolver,
    rendering.segmentPaddingCssRuleBuilder,
    rendering.layeredCaptionCssBuilder,
  );
  const baseline = new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true, isolation: true });
  let page: Page;

  beforeAll(async () => {
    page = await browser.newPage();
    await page.setContent(
      `<style>${baseline}</style><style id="sheet"></style>`
      + `<div id="scaler" style="position: relative; container-type: size; width: ${STAGE.width}px; height: ${STAGE.height}px;"></div>`,
    );
    await page.addScriptTag({ content: bundle });
  });

  afterAll(async () => { await page.close(); });

  async function atRest(name: string): Promise<TemplateAtRest> {
    const template = await loader.load(name);
    const sheet = Sheet.fromTemplate('main', 'Main', null, template, 'ltr');
    const videoFrame = template.rendering.videoFrame;
    return {
      css: artifacts.buildScopedCss(sheet, ElementStyles.empty()),
      scopeClass: artifacts.scopeClassFor(sheet.id),
      wrapperStyles: { ...artifacts.buildWrapperVars(sheet), ...rendering.segmentColorRotation.resolveOverrides(sheet, 's0', 0) },
      splitWordsIntoLetters: template.rendering.splitWordsIntoLetters,
      includeVideoFrameLayer: videoFrame.required && videoFrame.previewMode === 'live',
    };
  }

  /**
   * Every field of every word where the copy the probe reads — taken at
   * the instant its caption has been narrated through, with no animation
   * running — says something other than the caption painted at rest, with
   * its animations held on that frame as the preview holds them.
   *
   * At rest is 1.5 s after the last word is said, in a caption that stays
   * on screen 3.7 s after it, as one an effect lengthens does: every
   * entrance has finished and no exit has begun.
   */
  async function disagreements(template: TemplateAtRest): Promise<string[]> {
    await page.evaluate((css) => { document.getElementById('sheet')!.textContent = css; }, template.css);
    return page.evaluate((caption) => {
      const f = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
        RestingCaptionProbe: new (host: unknown, source: unknown, markup: unknown) => {
          read: (state: unknown, sheet: unknown, wordId: string, properties: ReadonlyArray<string>) => unknown;
        };
        RestingStyleFieldReader: new () => {
          propertiesFor: (fields: unknown) => ReadonlyArray<string>;
          read: (control: unknown, style: unknown) => string | number | undefined;
        };
        RestingElementStyle: new (own: ReadonlyMap<string, string>, parent: ReadonlyMap<string, string>) => unknown;
        markup: { build: (input: unknown, wordId: string) => string };
        wordFields: ReadonlyArray<{ id: string; controlFor: (surface: 'text') => unknown }>;
        Segment: new (props: unknown) => unknown;
        Line: new (props: unknown) => unknown;
        Word: new (props: unknown) => unknown;
        Section: new (props: unknown) => unknown;
        Document: new (props: unknown) => unknown;
        StructureTagger: new () => { tag: (document: unknown) => { sections: ReadonlyArray<{ segments: ReadonlyArray<unknown> }> } };
        Tag: { of: (name: string) => unknown };
        TimeFragment: new (start: number, end: number) => unknown;
      };
      // Every tag a word can carry, a word with none between them, over
      // three lines so a rule for the first, a middle or the last line has
      // something to match.
      const lines: ReadonlyArray<ReadonlyArray<readonly [string, string | null]>> = [
        [['we', null], ['were', null], ['unbelievable', 'emphasis'], ['today', null]],
        [['Paris', 'entity'], ['said', null], ['really', 'accent'], ['42', 'number'], ['percent', 'stat']],
        [['best', 'superlative'], ['ever', 'peak'], ['click', 'cta'], ['now', 'hook'], ['quoted', 'quote'], ['take', 'cut'], ['end', null]],
      ];
      let start = 0.5;
      const wordIds: string[] = [];
      const segment = new f.Segment({
        id: 's0',
        customTime: new f.TimeFragment(0, 9),
        lines: lines.map((words, lineIndex) => new f.Line({
          id: `l${lineIndex}`,
          words: words.map(([text, tag], wordIndex) => {
            const id = `w${lineIndex}_${wordIndex}`;
            wordIds.push(id);
            const time = new f.TimeFragment(start, start + 0.3);
            start += 0.3;
            return new f.Word({ id, text, time, semanticTags: new Set(tag ? [f.Tag.of(tag)] : []) });
          }),
        })),
      });
      const tagged = new f.StructureTagger().tag(new f.Document({ sections: [new f.Section({ kind: 'main', segments: [segment] })] }));
      const dressed = {
        ...caption,
        segment: tagged.sections[0]!.segments[0],
        segmentIndex: 0,
        textDirection: 'ltr',
        segmentStateClasses: [],
        positionedWordIds: new Set(),
      };
      const scaler = document.getElementById('scaler')!;
      const reader = new f.RestingStyleFieldReader();
      const properties = reader.propertiesFor(f.wordFields);
      const probe = new f.RestingCaptionProbe(
        { scaler: () => scaler, isSessionActive: () => false, subscribe: () => () => {} },
        { captionOf: () => dressed },
        f.markup,
      );
      const valuesOf = (resting: unknown): Record<string, string | number | null> => Object.fromEntries(
        f.wordFields.map((field) => [field.id, reader.read(field.controlFor('text'), resting) ?? null]),
      );
      const computedOf = (element: Element): ReadonlyMap<string, string> => {
        const computed = getComputedStyle(element);
        return new Map(properties.map((property) => [property, computed.getPropertyValue(property)]));
      };
      const paintedAtRest = (wordId: string): Record<string, string | number | null> => {
        const mount = document.createElement('div');
        mount.style.cssText = 'position: absolute; inset: 0; visibility: hidden; pointer-events: none; overflow: hidden; contain: strict;';
        mount.innerHTML = f.markup.build({ ...dressed, t: 6.8 }, wordId);
        scaler.appendChild(mount);
        try {
          const word = mount.querySelector(`[data-tscaps-el="${CSS.escape(wordId)}"]`)!;
          return valuesOf(new f.RestingElementStyle(computedOf(word), computedOf(word.parentElement!)));
        } finally {
          mount.remove();
        }
      };
      const found: string[] = [];
      for (const wordId of wordIds) {
        const resting = probe.read({}, {}, wordId, properties);
        if (resting === null) throw new Error(`The probe read nothing for ${wordId}.`);
        const copy = valuesOf(resting);
        const painted = paintedAtRest(wordId);
        for (const field of Object.keys(copy)) {
          if (copy[field] !== painted[field]) found.push(`${wordId}.${field}: copy ${copy[field]}, painted ${painted[field]}`);
        }
      }
      return found;
    }, template);
  }

  it.each(builtTemplateNames())('%s', async (name) => {
    expect(await disagreements(await atRest(name))).toEqual([]);
  });
});
