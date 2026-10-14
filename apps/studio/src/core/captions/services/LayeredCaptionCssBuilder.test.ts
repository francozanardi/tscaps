import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import {
  BaselineCssComposer,
  CssBlockSealer,
  CssFragmentParser,
  CssKeyframeNamespacer,
  CssLayer,
  CssClass,
  CssMinifier,
  CssScoper,
  FROZEN_FRAME_CSS,
} from '@tscaps/engine';
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
  return new LayeredCaptionCssBuilder(
    new CssKeyframeNamespacer(),
    new CssMinifier(),
    new CssBlockSealer(),
  );
}

function captionCss(templateCss: string, fragments: ElementStyles, sheet = SheetAnimationSet.empty()): string {
  return new CssScoper().scope(newBuilder().build(templateCss, sheet, fragments), `.${SCOPE}`);
}

function stylesheetForPreview(
  templateCss: string,
  fragments: ElementStyles,
  sheet = SheetAnimationSet.empty(),
): string {
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
    expect(caption).toBe('0.5s');
    expect(word).toBe('0.25s');
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
    expect(word).toBe('0.75s');
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
    expect(inside).toBe('0.25s');
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
    expect(glyph).toBe('0.4s');
  });

  it('reach a glyph the sheet lifted out of its word', async () => {
    const styles = animated(ElementStyles.empty(), 's1', 'segment', ElementAnimationScope.EMOJIS, 0.4);
    const [glyph] = await paintAndRead(
      stylesheetForPreview('.word { color: white }', styles),
      LIFTED_OUT_OF_IT,
      [['d', 'animation-duration']],
    );
    expect(glyph).toBe('0.4s');
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
    expect(glyph).toBe('0.75s');
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
    expect(first).toBe('0.5s');
    expect(second).toBe('0.5s');
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
    expect(caption).toBe('0.5s');
    expect(word).toBe('0.25s');
    expect(glyph).toBe('0.75s');
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
    expect(caption).toBe('0.5s');
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
    expect(word).toBe('0.25s');
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
    expect(addressed).toBe('0.9s');
    expect(untouched).toBe('0.5s');
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
