import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import {
  CssClass,
} from '@tscaps/engine';
import {
  BaselineCssComposer,
  CssFragmentParser,
  CssLayer,
  CssMinifier,
  CssScoper,
  FROZEN_FRAME_CSS,
} from '@tscaps/engine/advanced';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import { TestCaptionCss } from '@core/captions/testing/TestCaptionCss';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';

/**
 * What the assembled caption stylesheet promises, asked of a browser.
 *
 * The oracle has to be a real CSS engine. Every bug this file locks
 * produced output that was exactly what the builder meant to produce —
 * the mistakes were only mistakes to a parser, so asserting the text
 * would have passed while the caption rendered wrong.
 *
 * The two `stylesheetFor…` helpers mirror the production call sites:
 * `SheetOverlayArtifactsBuilder.buildScopedCss` for the preview and
 * `ExportVideoAction` for the export. Change either and change these.
 */

const SCOPE = 'tscaps-render-test';

let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

function newBuilder(): LayeredCaptionCssBuilder {
  return new TestCaptionCss().layeredCaptionCssBuilder;
}

function captionCss(templateCss: string, fragments: ElementStyles, sheet = SheetAnimationSet.empty()): string {
  return new CssScoper().scope(newBuilder().build(templateCss, sheet, fragments), `.${SCOPE}`);
}

function stylesheetForPreview(templateCss: string, fragments: ElementStyles, sheet = SheetAnimationSet.empty()): string {
  const frozen = new CssScoper().scope(FROZEN_FRAME_CSS, `.${SCOPE}`);
  return [
    new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true, isolation: true }),
    `@layer ${CssLayer.FRAMEWORK} {\n${frozen}\n}`,
    captionCss(templateCss, fragments, sheet),
  ].join('\n');
}

function stylesheetForExport(templateCss: string, fragments: ElementStyles): string {
  return [
    new BaselineCssComposer().compose({ decorations: true, videoFrame: true, isolation: true }),
    captionCss(templateCss, fragments),
  ].join('\n');
}

/** Paints `markup` under `stylesheet` and resolves each `[elementId, property]` pair against the result. */
async function paintAndRead(
  stylesheet: string,
  markup: string,
  reads: ReadonlyArray<readonly [elementId: string, property: string]>,
): Promise<string[]> {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>${stylesheet}</style><div class="${SCOPE}">${markup}</div>`);
    return await page.evaluate(
      (pairs) => pairs.map(([id, property]) =>
        getComputedStyle(document.getElementById(id)!).getPropertyValue(property)),
      reads as Array<[string, string]>,
    );
  } finally {
    await page.close();
  }
}

/**
 * The first animation in a computed list: the entrance a caption node
 * plays before its exit, which every answer lists in that order.
 */
function entranceOf(computed: string | undefined): string {
  return (computed ?? '').split(',')[0]!.trim();
}

describe('a fragment against the template', () => {
  it('wins without out-specifying anything', async () => {
    const fragments = ElementStyles.empty().withCss('w1', 'word', 'color: rgb(1, 2, 3);');
    const [colour] = await paintAndRead(
      stylesheetForPreview('.segment .word.hl { color: rgb(200, 200, 200) }', fragments),
      '<span class="segment"><span class="word hl" data-tscaps-el="w1" id="w1">a</span></span>',
      [['w1', 'color']],
    );
    expect(colour).toBe('rgb(1, 2, 3)');
  });

  it('reaches the element again with & for states and descendants', async () => {
    const fragments = ElementStyles.empty().withCss(
      'w1', 'word',
      '& .inner { color: rgb(10, 11, 12) }',
    );
    const [inner] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', fragments),
      '<span class="word" data-tscaps-el="w1">a<span class="inner" id="inner">b</span></span>',
      [['inner', 'color']],
    );
    expect(inner).toBe('rgb(10, 11, 12)');
  });
});

describe('a fragment whose braces do not pair up', () => {
  const escaping = ElementStyles.empty()
    .withCss('w1', 'word', 'color: rgb(1, 2, 3); } .loose { color: rgb(9, 9, 9) }')
    .withCss('w2', 'word', 'color: rgb(4, 5, 6);');

  const markup = '<span class="word" data-tscaps-el="w1" id="w1">a</span>'
    + '<span class="word" data-tscaps-el="w2" id="w2">b</span>'
    + '<span class="loose" id="stranger">c</span>';

  it('cannot reach an element it does not address', async () => {
    const [stranger] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', escaping),
      markup,
      [['stranger', 'color']],
    );
    expect(stranger).toBe('rgb(0, 0, 0)');
  });

  it('leaves the fragments after it alone', async () => {
    const [first, second] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', escaping),
      markup,
      [['w1', 'color'], ['w2', 'color']],
    );
    expect(first).toBe('rgb(1, 2, 3)');
    expect(second).toBe('rgb(4, 5, 6)');
  });
});

describe('an animation in a fragment', () => {
  const POP = `animation: pop 0.6s var(--on-word-being-narrated-starts) linear both;
@keyframes pop { from { scale: 1 } to { scale: 3 } }`;

  it('renders the frame its delay points at, not the wall clock', async () => {
    const fragments = ElementStyles.empty().withCss('w1', 'word', POP);
    const [start, middle, end] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', fragments),
      `<span class="word" data-tscaps-el="w1" id="w1" style="--on-word-being-narrated-starts: 0s">a</span>
       <span class="word" data-tscaps-el="w1" id="w2" style="--on-word-being-narrated-starts: -0.3s">b</span>
       <span class="word" data-tscaps-el="w1" id="w3" style="--on-word-being-narrated-starts: -0.6s">c</span>`,
      [['w1', 'scale'], ['w2', 'scale'], ['w3', 'scale']],
    );
    expect(start).toBe('1');
    expect(middle).toBe('2');
    expect(end).toBe('3');
  });

  it('survives an element id carrying punctuation', async () => {
    const fragments = ElementStyles.empty().withCss('word-7:d', 'decoration', POP);
    const [scale] = await paintAndRead(
      stylesheetForPreview('.word-decoration { color: white }', fragments),
      '<span class="word-decoration" data-tscaps-el="word-7:d" id="d" style="--on-word-being-narrated-starts: -0.6s">x</span>',
      [['d', 'scale']],
    );
    expect(scale).toBe('3');
  });

  it('stays the element\'s own when another id sanitizes to the same text', async () => {
    const fragments = ElementStyles.empty()
      .withCss('w1:d', 'decoration', 'animation: pop 1s -1s linear both; @keyframes pop { to { scale: 5 } }')
      .withCss('w1-d', 'word', 'animation: pop 1s -1s linear both; @keyframes pop { to { scale: 9 } }');
    const [decoration, word] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', fragments),
      '<span data-tscaps-el="w1:d" id="a">a</span><span data-tscaps-el="w1-d" id="b">b</span>',
      [['a', 'scale'], ['b', 'scale']],
    );
    expect(decoration).toBe('5');
    expect(word).toBe('9');
  });

  it('can name keyframes the template defined', async () => {
    const fragments = ElementStyles.empty().withCss('w1', 'word', 'animation: shared 1s -1s linear both;');
    const [scale] = await paintAndRead(
      stylesheetForPreview('.word { color: white } @keyframes shared { to { scale: 4 } }', fragments),
      '<span class="word" data-tscaps-el="w1" id="w1">a</span>',
      [['w1', 'scale']],
    );
    expect(scale).toBe('4');
  });

  it('shadows the template\'s keyframes when it defines the same name', async () => {
    const fragments = ElementStyles.empty()
      .withCss('w1', 'word', 'animation: shared 1s -1s linear both;')
      .withCss('w2', 'word', 'animation: shared 1s -1s linear both; @keyframes shared { to { scale: 7 } }');
    const [borrowed, own] = await paintAndRead(
      stylesheetForPreview('.word { color: white } @keyframes shared { to { scale: 4 } }', fragments),
      '<span class="word" data-tscaps-el="w1" id="w1">a</span><span class="word" data-tscaps-el="w2" id="w2">b</span>',
      [['w1', 'scale'], ['w2', 'scale']],
    );
    expect(borrowed).toBe('4');
    expect(own).toBe('7');
  });
});

describe('the two animations a caption can be given', () => {
  const animationCssWriter = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
    new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
    new ElementTimingVariableResolver(),
    new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
  ));

  /** Gives one of the element's parts `fade-in`, tuned to a duration nothing else uses. */
  function animated(
    styles: ElementStyles,
    elementId: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    seconds: number,
  ): ElementStyles {
    const animation = { presetId: 'fade-in', params: { duration: seconds } };
    const css = animationCssWriter.rewrite(styles.get(elementId)?.css ?? '', kind, scope, undefined, animation);
    return styles.withAnimation(elementId, kind, scope, animation, css);
  }

  // The clocks are stamped inline the way the renderer stamps them. An
  // animation whose delay names a variable nothing declares is not a
  // slow animation, it is no animation at all.
  const SEGMENT_CLOCK = 'style="--on-segment-starts: 0s"';
  const WORD_CLOCK = 'style="--on-word-being-narrated-starts: 0s"';
  const CAPTION = `<div class="segment" data-tscaps-el="s1" id="seg" ${SEGMENT_CLOCK}>`
    + `<span class="word" id="w" ${WORD_CLOCK}>a</span></div>`;
  const CAPTION_WITH_STYLED_WORD = `<div class="segment" data-tscaps-el="s1" id="seg" ${SEGMENT_CLOCK}>`
    + `<span class="word" data-tscaps-el="w1" id="w" ${WORD_CLOCK}>a</span></div>`;

  it('land on different elements, each on its own', async () => {
    const styles = animated(
      animated(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.SELF, 0.5),
      's1', 'segment', ElementAnimationScope.WORDS, 0.25,
    );
    const [caption, word] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      CAPTION,
      [['seg', 'animation-duration'], ['w', 'animation-duration']],
    );
    expect(entranceOf(caption)).toBe('0.5s');
    expect(entranceOf(word)).toBe('0.25s');
  });

  // Both rules address one element each at the same weight in the same
  // layer, so the only thing left to separate them is which was written
  // first. The word is styled before the caption here on purpose: read
  // in the order they arrived, the caption's rule would come last and
  // the answer the user gave this word would lose.
  it('lose to the answer given to one word in particular', async () => {
    const styles = animated(
      animated(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.SELF, 0.75),
      's1', 'segment', ElementAnimationScope.WORDS, 0.25,
    );
    const [word] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      CAPTION_WITH_STYLED_WORD,
      [['w', 'animation-duration']],
    );
    expect(entranceOf(word)).toBe('0.75s');
  });

  it('lose to one word told not to move at all', async () => {
    const withoutOwn = ElementStyles.empty()
      .withAnimation('w1', 'word', ElementAnimationScope.SELF, { presetId: null, params: {} }, 'animation: none;');
    const styles = animated(withoutOwn, 's1', 'segment', ElementAnimationScope.WORDS, 0.25);
    const [word] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      CAPTION_WITH_STYLED_WORD,
      [['w', 'animation-name']],
    );
    expect(word).toBe('none');
  });

  it('reach the words of the caption they were given to and no others', async () => {
    const styles = animated(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.WORDS, 0.25);
    const [inside, outside] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      `${CAPTION}<div class="segment"><span class="word" id="stranger" ${WORD_CLOCK}>b</span></div>`,
      [['w', 'animation-duration'], ['stranger', 'animation-duration']],
    );
    expect(entranceOf(inside)).toBe('0.25s');
    expect(outside).toBe('0s');
  });

  /**
   * Where a glyph is painted is the sheet's emoji placement to decide:
   * inside its word, or lifted into a container of the segment's own.
   * The answer given to the caption's glyphs has to hold either way —
   * that it did not is why the scope exists.
   */
  const GLYPH = `<span class="word-decoration" id="d" ${WORD_CLOCK}>x</span>`;
  const INSIDE_ITS_WORD = `<div class="segment" data-tscaps-el="s1" id="seg" ${SEGMENT_CLOCK}>`
    + `<span class="word" ${WORD_CLOCK}>a${GLYPH}</span></div>`;
  const LIFTED_OUT_OF_IT = `<div class="segment" data-tscaps-el="s1" id="seg" ${SEGMENT_CLOCK}>`
    + `<span class="word" ${WORD_CLOCK}>a</span>`
    + `<div class="${CssClass.SEGMENT_DECORATIONS_BELOW}">${GLYPH}</div></div>`;

  it('reach a glyph painted inside its word', async () => {
    const styles = animated(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.EMOJIS, 0.4);
    const [glyph] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      INSIDE_ITS_WORD,
      [['d', 'animation-duration']],
    );
    expect(entranceOf(glyph)).toBe('0.4s');
  });

  it('reach a glyph the sheet lifted out of its word', async () => {
    const styles = animated(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.EMOJIS, 0.4);
    const [glyph] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      LIFTED_OUT_OF_IT,
      [['d', 'animation-duration']],
    );
    expect(entranceOf(glyph)).toBe('0.4s');
  });

  it('leave the words alone: a glyph is not one of them', async () => {
    const styles = animated(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.EMOJIS, 0.4);
    const [word] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      `<div class="segment" data-tscaps-el="s1" id="seg" ${SEGMENT_CLOCK}>`
        + `<span class="word" id="w" ${WORD_CLOCK}>a${GLYPH}</span></div>`,
      [['w', 'animation-duration']],
    );
    expect(word).toBe('0s');
  });

  it('lose to the answer given to one glyph in particular', async () => {
    const styles = animated(
      animated(ElementStyles.empty(), 'd1', 'decoration', ElementAnimationScope.SELF, 0.75),
      's1', 'segment', ElementAnimationScope.EMOJIS, 0.4,
    );
    const [glyph] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      `<div class="segment" data-tscaps-el="s1" id="seg" ${SEGMENT_CLOCK}>`
        + `<span class="word" ${WORD_CLOCK}>a`
        + `<span class="word-decoration" data-tscaps-el="d1" id="d" ${WORD_CLOCK}>x</span></span></div>`,
      [['d', 'animation-duration']],
    );
    expect(entranceOf(glyph)).toBe('0.75s');
  });
});

/**
 * The three layers answer three questions, and the later one wins
 * without out-specifying the earlier. A sheet's rule addresses a bare
 * class and an element's addresses one id, so on specificity alone the
 * sheet would beat every element it covers.
 */
describe('an animation the sheet gives every element of a kind', () => {
  const builder = new ElementAnimationCssBuilder(
    new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
    new ElementTimingVariableResolver(),
    new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
  );
  const writer = new ElementAnimationCssWriter(builder);

  /** Gives every element the scope names `fade-in`, tuned to a duration nothing else uses. */
  function sheetAnimated(
    animations: SheetAnimationSet,
    scope: ElementAnimationScope,
    seconds: number,
  ): SheetAnimationSet {
    const animation = { presetId: 'fade-in', params: { duration: seconds } };
    return animations.with(scope, { kind: 'replaced', animation, css: builder.buildForEveryElement(animation, scope) });
  }

  const SEGMENT_CLOCK = 'style="--on-segment-starts: 0s"';
  const WORD_CLOCK = 'style="--on-word-being-narrated-starts: 0s"';
  const TWO_CAPTIONS = `<div class="segment" id="a" ${SEGMENT_CLOCK}>`
    + `<span class="word" id="wa" ${WORD_CLOCK}>a`
    + `<span class="word-decoration" id="da" ${WORD_CLOCK}>x</span></span></div>`
    + `<div class="segment" id="b" ${SEGMENT_CLOCK}>`
    + `<span class="word" id="wb" ${WORD_CLOCK}>b</span></div>`;

  it('reaches every one of them, not the one that was open', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.SEGMENTS, 0.5);
    const [first, second] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', ElementStyles.empty(), sheet),
      TWO_CAPTIONS,
      [['a', 'animation-duration'], ['b', 'animation-duration']],
    );
    expect(entranceOf(first)).toBe('0.5s');
    expect(entranceOf(second)).toBe('0.5s');
  });

  it('answers each kind on its own', async () => {
    const sheet = sheetAnimated(
      sheetAnimated(sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.SEGMENTS, 0.5),
        ElementAnimationScope.WORDS, 0.25),
      ElementAnimationScope.EMOJIS, 0.75,
    );
    const [caption, word, glyph] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', ElementStyles.empty(), sheet),
      TWO_CAPTIONS,
      [['a', 'animation-duration'], ['wa', 'animation-duration'], ['da', 'animation-duration']],
    );
    expect(entranceOf(caption)).toBe('0.5s');
    expect(entranceOf(word)).toBe('0.25s');
    expect(entranceOf(glyph)).toBe('0.75s');
  });

  it('beats the template it started from without out-specifying it', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.SEGMENTS, 0.5);
    const template = '.segment { animation: shrink 9s linear both }'
      + '@keyframes shrink { to { scale: 0 } }';
    const [caption] = await paintAndRead(
      stylesheetForPreview(template, ElementStyles.empty(), sheet),
      TWO_CAPTIONS,
      [['a', 'animation-duration']],
    );
    expect(entranceOf(caption)).toBe('0.5s');
  });

  // The state class is the shape a template reaches for constantly —
  // pepper's pill grows on `.word-being-narrated`. Both rules land on
  // the same element, so layer order settles it and specificity never
  // comes up.
  it('beats the template even where the template addressed a state of the element', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.WORDS, 0.25);
    const template = '.word-being-narrated { animation: shrink 9s linear both }'
      + '@keyframes shrink { to { scale: 0 } }';
    const [word] = await paintAndRead(
      stylesheetForPreview(template, ElementStyles.empty(), sheet),
      `<div class="segment" id="a" ${SEGMENT_CLOCK}>`
        + `<span class="word word-being-narrated" id="wa" ${WORD_CLOCK}>a</span></div>`,
      [['wa', 'animation-duration']],
    );
    expect(entranceOf(word)).toBe('0.25s');
  });

  // A `::before` is a different element, so no rule about the word can
  // reach it and the template's own would go on playing beside the
  // sheet's. Silencing it is the only honest answer: the box is not the
  // word, and the sheet's answer never mentioned it.
  it('silences an animation the template gave the element\'s generated box', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.WORDS, 0.25);
    const template = '.word-being-narrated::before { content: ""; animation: shrink 9s linear both }'
      + '@keyframes shrink { to { scale: 0 } }';
    const page = await browser.newPage();
    try {
      await page.setContent(
        `<style>${stylesheetForPreview(template, ElementStyles.empty(), sheet)}</style>`
        + `<div class="${SCOPE}"><div class="segment" id="a" ${SEGMENT_CLOCK}>`
        + `<span class="word word-being-narrated" id="wa" ${WORD_CLOCK}>a</span></div></div>`,
      );
      const pill = await page.evaluate(
        () => getComputedStyle(document.getElementById('wa')!, '::before').animationName,
      );
      expect(pill).toBe('none');
    } finally {
      await page.close();
    }
  });

  // A letter has no panel of its own, so nothing can ever be said about
  // it separately: how it appears is part of how its word appears, and
  // an answer about words that left it typing would be two answers.
  it('silences an animation the template gave a node no answer covers', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.WORDS, 0.25);
    const template = '.letter { animation: shrink 9s linear both }'
      + '@keyframes shrink { to { scale: 0 } }';
    const [letter] = await paintAndRead(
      stylesheetForPreview(template, ElementStyles.empty(), sheet),
      `<div class="segment" id="a" ${SEGMENT_CLOCK}>`
        + `<span class="word" id="wa" ${WORD_CLOCK}><span class="letter" id="l">a</span></span></div>`,
      [['l', 'animation-name']],
    );
    expect(letter).toBe('none');
  });

  // The glyph beside a word answers for itself, so the words' answer
  // has to leave it alone even though it sits inside one.
  it('leaves a node that answers for itself alone', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.WORDS, 0.25);
    const template = '.word-decoration { animation: shrink 9s linear both }'
      + '@keyframes shrink { to { scale: 0 } }';
    const [glyph] = await paintAndRead(
      stylesheetForPreview(template, ElementStyles.empty(), sheet),
      `<div class="segment" id="a" ${SEGMENT_CLOCK}>`
        + `<span class="word" id="wa" ${WORD_CLOCK}>a`
        + `<span class="word-decoration" id="d" ${WORD_CLOCK}>x</span></span></div>`,
      [['d', 'animation-duration']],
    );
    expect(glyph).toBe('9s');
  });

  // A line is the caption's business: it has no panel either, and the
  // caption's answer is the only thing that could ever replace it.
  it('silences a line when the captions are answered for', async () => {
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.SEGMENTS, 0.5);
    const template = '.line { animation: shrink 9s linear both }'
      + '@keyframes shrink { to { scale: 0 } }';
    const [line] = await paintAndRead(
      stylesheetForPreview(template, ElementStyles.empty(), sheet),
      `<div class="segment" id="a" ${SEGMENT_CLOCK}>`
        + `<span class="line" id="ln"><span class="word" id="wa" ${WORD_CLOCK}>a</span></span></div>`,
      [['ln', 'animation-name']],
    );
    expect(line).toBe('none');
  });

  it('loses to the answer one element gave for itself', async () => {
    const own = { presetId: 'fade-in', params: { duration: 0.9 } };
    const styles = ElementStyles.empty().withAnimation(
      'seg-a', 'segment', ElementAnimationScope.SELF, own,
      writer.rewrite('', 'segment', ElementAnimationScope.SELF, undefined, own),
    );
    const sheet = sheetAnimated(SheetAnimationSet.empty(), ElementAnimationScope.SEGMENTS, 0.5);
    const [addressed, untouched] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles, sheet),
      `<div class="segment" data-tscaps-el="seg-a" id="a" ${SEGMENT_CLOCK}></div>`
        + `<div class="segment" id="b" ${SEGMENT_CLOCK}></div>`,
      [['a', 'animation-duration'], ['b', 'animation-duration']],
    );
    expect(entranceOf(addressed)).toBe('0.9s');
    expect(entranceOf(untouched)).toBe('0.5s');
  });
});

/**
 * Reaching a value inside an animation the template wrote, rather than
 * replacing the animation.
 *
 * A template does not declare its animation on the bare class. It
 * declares it on whatever selector its design needs — a word only in
 * the first caption, a line only when it is the last — and the value
 * the keyframes read sits on that same rule. So the question is not
 * whether the sheet can out-specify that selector, which it cannot,
 * but whether it has to: both declarations land on the same element,
 * and layer order is settled before specificity is ever consulted.
 *
 * The selector below is milo's, which is the worst case in the
 * library. If the bare class wins there it wins everywhere, and a dial
 * over a template's own animation needs nothing from the primitives.
 */
describe('a value the sheet writes over one the template declared', () => {
  const MILO_SHAPED = ':is(.segment-after-pause, .first-segment-in-document) .word:not(.last-word-in-line) {'
    + '  --entrance-duration: 9s;'
    + '  animation: travel var(--entrance-duration) linear both;'
    + '}'
    + '@keyframes travel { from { opacity: 0 } }';

  const CAPTION = '<div class="segment first-segment-in-document" style="--on-segment-starts: 0s">'
    + '<span class="word" id="w" style="--on-word-being-narrated-starts: 0s">a</span></div>';

  /** A sheet block that only re-answers a value, with no animation of its own in it. */
  function sheetDeclaring(css: string): SheetAnimationSet {
    return SheetAnimationSet.empty().with(ElementAnimationScope.WORDS, { kind: 'tuned', values: {}, css });
  }

  it('is what the animation runs on, through a selector it cannot out-specify', async () => {
    const [duration] = await paintAndRead(
      stylesheetForPreview(MILO_SHAPED, ElementStyles.empty(), sheetDeclaring('.word { --entrance-duration: 0.4s }')),
      CAPTION,
      [['w', 'animation-duration']],
    );
    expect(duration).toBe('0.4s');
  });

  it('leaves the template’s own value standing when it says nothing', async () => {
    const [duration] = await paintAndRead(
      stylesheetForPreview(MILO_SHAPED, ElementStyles.empty()),
      CAPTION,
      [['w', 'animation-duration']],
    );
    expect(duration).toBe('9s');
  });
});

describe('the preview and the export', () => {
  const fragments = ElementStyles.empty().withCss('d1', 'decoration', 'font-size: 5em;');
  const markup = '<span class="segment" style="font-size: 16px">'
    + '<span class="word-decoration" data-tscaps-el="d1" id="d">x</span></span>';

  it('agree on whether a fragment outranks the framework baseline', async () => {
    const [preview] = await paintAndRead(stylesheetForPreview('.word { color: white }', fragments), markup, [['d', 'font-size']]);
    const [exported] = await paintAndRead(stylesheetForExport('.word { color: white }', fragments), markup, [['d', 'font-size']]);
    expect(preview).toBe(exported);
    expect(preview).toBe('80px');
  });

  it('agree on the baseline that no fragment touches', async () => {
    const untouched = ElementStyles.empty();
    const [preview] = await paintAndRead(stylesheetForPreview('.word { color: white }', untouched), markup, [['d', 'font-size']]);
    const [exported] = await paintAndRead(stylesheetForExport('.word { color: white }', untouched), markup, [['d', 'font-size']]);
    expect(preview).toBe(exported);
    expect(preview).toBe('28.8px');
  });
});

/**
 * An element plays how it comes in and how it leaves through one
 * `animation`, and each end can be answered at a different level. Every
 * promise here is about the two playing together: neither erasing the
 * other, the exit leaving the entrance's frames exactly as they were
 * until it starts, and the template's own motion going on where it can.
 */
describe('the two ends of an element\'s motion', () => {
  const css = new TestCaptionCss();

  /** `styles` with one part of one element answered `animation`, written the way the panel writes it. */
  function given(
    styles: ElementStyles,
    elementId: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    animation: ElementAnimation,
  ): ElementStyles {
    const previous = styles.animationOf(elementId, scope) ?? undefined;
    const written = css.animationCssWriter.rewrite(styles.get(elementId)?.css ?? '', kind, scope, previous, animation);
    return styles.withAnimation(elementId, kind, scope, animation, written);
  }

  function sheetGiven(sheet: SheetAnimationSet, scope: ElementAnimationScope, animation: ElementAnimation): SheetAnimationSet {
    return sheet.with(scope, { kind: 'replaced', animation, css: css.animationCssBuilder.buildForEveryElement(animation, scope) });
  }

  const fadeIn: ElementAnimation = { presetId: 'fade-in', params: { duration: 0.4 } };
  const fadeOut: ElementAnimation = { presetId: 'fade-out', params: { duration: 0.4 } };
  const still: ElementAnimation = { presetId: null, params: {} };

  /**
   * One caption of `seconds` holding one word, at a playhead
   * `sinceNarrated` into the word and `untilEnd` before the caption
   * leaves, stamped the way the renderer stamps its clocks.
   */
  function captionAt(id: string, sinceNarrated: number, untilEnd: number, seconds = 4, wordId = 'w1'): string {
    return `<div class="segment" data-tscaps-el="s1" style="--on-segment-starts: -1s; --on-segment-ends: ${untilEnd}s; `
      + `--segment-duration: ${seconds}s">`
      + `<span class="word" data-tscaps-el="${wordId}" id="${id}" style="--on-word-being-narrated-starts: ${-sinceNarrated}s">a</span>`
      + '</div>';
  }

  async function opacityOf(stylesheet: string, sinceNarrated: number, untilEnd: number, seconds = 4): Promise<number> {
    const [opacity] = await paintAndRead(stylesheet, captionAt('w', sinceNarrated, untilEnd, seconds), [['w', 'opacity']]);
    return Number(opacity);
  }

  it('lets an entrance and an exit given to one word both play', async () => {
    const both = given(given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.SELF, fadeIn),
      'w1', 'word', ElementAnimationScope.EXIT, fadeOut);
    const entranceOnly = given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.SELF, fadeIn);
    const template = '.word { color: white }';

    const arriving = await opacityOf(stylesheetForPreview(template, both), 0.2, 3);
    expect(arriving).toBeGreaterThan(0);
    expect(arriving).toBeLessThan(1);
    // Until the exit starts it holds nothing over the entrance: the frame
    // is the one the entrance alone paints.
    expect(arriving).toBe(await opacityOf(stylesheetForPreview(template, entranceOnly), 0.2, 3));

    const leaving = await opacityOf(stylesheetForPreview(template, both), 5, 0.2);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(1);
    expect(await opacityOf(stylesheetForPreview(template, both), 5, 0)).toBe(0);
  });

  it('leaves a word with its caption, not when its own narration ends', async () => {
    const styles = given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.EXIT, fadeOut);
    const stylesheet = stylesheetForPreview('.word { color: white }', styles);

    expect(await opacityOf(stylesheet, 2, 1)).toBe(1);
    expect(await opacityOf(stylesheet, 2, 0.2)).toBeLessThan(1);
  });

  it('plays the caption\'s exit for its words beside the entrance one word was given', async () => {
    const styles = given(given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.SELF, fadeIn),
      's1', 'segment', ElementAnimationScope.WORDS_EXIT, fadeOut);
    const stylesheet = stylesheetForPreview('.word { color: white }', styles);

    expect(await opacityOf(stylesheet, 0.2, 3)).toBeLessThan(1);
    expect(await opacityOf(stylesheet, 5, 3)).toBe(1);
    expect(await opacityOf(stylesheet, 5, 0.2)).toBeLessThan(1);
  });

  it('plays the sheet\'s exit for every word beside the entrance a caption gave its words', async () => {
    const styles = given(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.WORDS, fadeIn);
    const sheet = sheetGiven(SheetAnimationSet.empty(), ElementAnimationScope.WORDS_EXIT, fadeOut);
    const stylesheet = stylesheetForPreview('.word { color: white }', styles, sheet);

    expect(await opacityOf(stylesheet, 0.2, 3)).toBeLessThan(1);
    expect(await opacityOf(stylesheet, 5, 3)).toBe(1);
    expect(await opacityOf(stylesheet, 5, 0.2)).toBeLessThan(1);
  });

  it('takes back an exit from further out on a word told not to leave with any', async () => {
    const styles = given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.EXIT, still);
    const sheet = sheetGiven(SheetAnimationSet.empty(), ElementAnimationScope.WORDS_EXIT, fadeOut);

    expect(await opacityOf(stylesheetForPreview('.word { color: white }', styles, sheet), 5, 0.2)).toBe(1);
  });

  it('leaves the template moving a word told not to leave with any exit', async () => {
    const styles = given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.EXIT, still);
    const template = '.word-being-narrated { animation: grow 9s linear both } @keyframes grow { to { scale: 2 } }';
    const [name] = await paintAndRead(
      stylesheetForPreview(template, styles),
      '<div class="segment"><span class="word word-being-narrated" data-tscaps-el="w1" id="w">a</span></div>',
      [['w', 'animation-name']],
    );
    expect(name).toContain('grow');
  });

  it('cuts an exit to half a caption too short for it', async () => {
    const styles = given(ElementStyles.empty(), 'w1', 'word', ElementAnimationScope.EXIT, fadeOut);
    const stylesheet = stylesheetForPreview('.word { color: white }', styles);

    expect(await opacityOf(stylesheet, 0, 0.15, 0.2)).toBe(1);
    expect(await opacityOf(stylesheet, 0, 0.05, 0.2)).toBeLessThan(1);
  });

  describe('over the template\'s own motion', () => {
    const GROW = '@keyframes grow { from { scale: 1 } to { scale: 2 } }';
    const SHRINK = '@keyframes shrink { from { scale: 2 } to { scale: 1.5 } }';
    const PLAYS_BOTH = 'animation: var(--word-entrance-animation, none), var(--word-exit-animation, none)';
    const sheet = sheetGiven(SheetAnimationSet.empty(), ElementAnimationScope.WORDS_EXIT, fadeOut);

    function wordIn(state: string): string {
      return '<div class="segment" style="--on-segment-ends: 0.2s; --segment-duration: 4s">'
        + `<span class="word ${state}" id="w" style="--on-word-being-narrated-starts: -1s; `
        + '--on-word-already-narrated-starts: -0.5s">a</span></div>';
    }

    async function scaleAndOpacity(template: string, given: SheetAnimationSet, state = 'word-being-narrated'): Promise<string[]> {
      return paintAndRead(stylesheetForPreview(template, ElementStyles.empty(), given), wordIn(state), [['w', 'scale'], ['w', 'opacity']]);
    }

    // What `declared.plays` writes: each rule publishes the motion in its
    // end's slot, and the cascade picks the rule as it always did.
    const PUBLISHED = '.word { display: inline-block; '
      + `--word-entrance-animation: grow 2s var(--on-word-being-narrated-starts) linear both; ${PLAYS_BOTH} } `
      + `.word-already-narrated { --word-entrance-animation: shrink 1s var(--on-word-already-narrated-starts) linear both; ${PLAYS_BOTH} } `
      + `${GROW} ${SHRINK}`;

    it('plays an exit after the motion it publishes, whichever of its rules gives it', async () => {
      for (const state of ['word-being-narrated', 'word-already-narrated']) {
        const [scale, opacity] = await scaleAndOpacity(PUBLISHED, sheet, state);
        const [unexited] = await scaleAndOpacity(PUBLISHED, SheetAnimationSet.empty(), state);

        expect(scale).toBe(unexited);
        expect(scale).not.toBe('1');
        expect(Number(opacity)).toBeLessThan(1);
      }
    });

    it('gives way to an entrance picked for the words', async () => {
      const [scale] = await scaleAndOpacity(PUBLISHED, sheetGiven(sheet, ElementAnimationScope.WORDS, fadeIn));
      expect(scale).toBe('none');
    });

    it('lets None take back an exit it publishes', async () => {
      const template = '.word { display: inline-block; '
        + `--word-exit-animation: fade 1s calc(var(--on-segment-ends) - 1s) linear both; ${PLAYS_BOTH} } `
        + '@keyframes fade { to { opacity: 0 } }';
      const [, leaving] = await scaleAndOpacity(template, SheetAnimationSet.empty());
      const [, kept] = await scaleAndOpacity(template, sheetGiven(SheetAnimationSet.empty(), ElementAnimationScope.WORDS_EXIT, still));

      expect(Number(leaving)).toBeLessThan(1);
      expect(Number(kept)).toBe(1);
    });

    // A stylesheet written by hand or by a model may play its motion
    // through `animation` itself. An exit declares `animation` too, so it
    // takes that motion's place, as an entrance picked there always has.
    it('is replaced by an exit when it writes `animation` itself', async () => {
      const template = `.word { display: inline-block; animation: grow 2s var(--on-word-being-narrated-starts) linear both } ${GROW}`;
      const [scale, opacity] = await scaleAndOpacity(template, sheet);

      expect(scale).toBe('none');
      expect(Number(opacity)).toBeLessThan(1);
    });

    describe('as a built template writes it', () => {
      const TEMPLATES = resolve(import.meta.dirname, '../../../../../../presets/templates');
      const READS = ['translate', 'background-position', 'transform', 'opacity'];

      /** One caption of two lines at `at` seconds into its four, its words said one after another from 0.5 s. */
      function captionAt(at: number): string {
        const words = ['one', 'two', 'three', 'four'].map((text, index) => {
          const start = 0.5 + index * 0.5;
          const state = at < start ? 'word-not-narrated-yet' : at < start + 0.5 ? 'word-being-narrated' : 'word-already-narrated';
          return `<span class="word ${state}" id="w${index}" style="--on-word-being-narrated-starts: ${start - at}s; `
            + `--on-word-already-narrated-starts: ${start + 0.5 - at}s; --word-being-narrated-duration: 0.5s">${text}</span>`;
        });
        return `<div class="segment" style="--on-segment-starts: ${-at}s; --on-segment-ends: ${4 - at}s; --segment-duration: 4s">`
          + `<span class="line first-line-in-segment">${words.slice(0, 2).join(' ')}</span>`
          + `<span class="line last-line-in-segment">${words.slice(2).join(' ')}</span></div>`;
      }

      async function wordsOf(template: string, given: SheetAnimationSet, at: number): Promise<string[]> {
        const css = readFileSync(`${TEMPLATES}/${template}/style.build.css`, 'utf8');
        const reads = ['w0', 'w1', 'w2', 'w3'].flatMap((id) => READS.map((property) => [id, property] as const));
        return paintAndRead(stylesheetForPreview(css, ElementStyles.empty(), given), captionAt(at), reads);
      }

      // Nina sweeps the word being said and settles it once said, from
      // two rules; Luca slides its words in but holds its first line's
      // still, from a third. Every one of those frames has to survive.
      it.each(['nina', 'luca'])('%s moves its words exactly as before until they leave', async (template) => {
        for (const at of [0.1, 0.7, 1.2, 1.9, 2.6, 3.2]) {
          expect(await wordsOf(template, sheet, at)).toEqual(await wordsOf(template, SheetAnimationSet.empty(), at));
        }
      });
    });

    it('keeps the boxes it moves moving: an exit takes nothing over', async () => {
      const template = '.word::before { content: ""; animation: grow 2s var(--on-word-being-narrated-starts) linear both } '
        + GROW;
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${stylesheetForPreview(template, ElementStyles.empty(), sheet)}</style>`
          + `<div class="${SCOPE}">${wordIn('word-being-narrated')}</div>`);
        const box = await page.evaluate(() => getComputedStyle(document.getElementById('w')!, '::before').animationName);
        expect(box).toContain('grow');
      } finally {
        await page.close();
      }
    });
  });
});

describe('a line\'s own fields', () => {
  const TEMPLATE = `.segment {
    font-weight: var(--tscaps-font-weight, 400);
    color: var(--tscaps-primary-color, rgb(255, 255, 255));
    font-size: calc(var(--tscaps-font-size, 10px) * var(--tscaps-font-size-scale, 1));
  }
  .emphasis { font-weight: 300 }`;

  const fragments = ElementStyles.empty()
    .withField('l1', 'line', 'font-weight', 900, '--tscaps-font-weight: 900;')
    .withField('l1', 'line', 'primary-color', '#010203', '--tscaps-font-weight: 900; --tscaps-primary-color: #010203;')
    .withField('l1', 'line', 'font-size', 20, '--tscaps-font-weight: 900; --tscaps-primary-color: #010203; --tscaps-font-size: 20px;');

  const markup = '<span class="segment">'
    + '<span class="line" data-tscaps-el="l1"><span class="word" id="set">a</span><span class="word emphasis" id="tagged">b</span></span>'
    + '<span class="line"><span class="word" id="other">c</span></span>'
    + '</span>';

  it('reach the words the template paints from the caption', async () => {
    const [weight, colour, size] = await paintAndRead(
      stylesheetForExport(TEMPLATE, fragments),
      markup,
      [['set', 'font-weight'], ['set', 'color'], ['set', 'font-size']],
    );
    expect([weight, colour, size]).toEqual(['900', 'rgb(1, 2, 3)', '20px']);
  });

  it('leave the template\'s own rule on a word and the other lines as they were', async () => {
    const [tagged, other] = await paintAndRead(
      stylesheetForExport(TEMPLATE, fragments),
      markup,
      [['tagged', 'font-weight'], ['other', 'font-weight']],
    );
    expect([tagged, other]).toEqual(['300', '400']);
  });
});
