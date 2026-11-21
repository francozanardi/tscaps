import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { CssLayer, CssScoper, FROZEN_FRAME_CSS } from '@tscaps/engine/advanced';
import { TestCaptionCss } from '@core/captions/testing/TestCaptionCss';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles, type ElementStylesSnapshot } from '@core/elements/domain/ElementStyles';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import { ProjectV27ToV28Migration } from '@core/projects/services/migrations/ProjectV27ToV28Migration';

/**
 * What happens to an entrance saved before an element could also leave.
 *
 * At v27 an entrance wrote `animation` whole. Carried over as it was, it
 * would render the same and quietly erase any exit given to the same
 * element at another level, and the panel would no longer recognise the
 * block as its own. So the step is judged on three things: the panel
 * still finds the block, the caption paints exactly what it painted, and
 * an exit given afterwards plays beside the entrance.
 *
 * The stored text is written out as v27 wrote it rather than built here:
 * a fixture produced by today's code would agree with today's code by
 * construction.
 */

const css = new TestCaptionCss();
const migration = new ProjectV27ToV28Migration(css.animationCssBuilder);
const SCOPE = 'tscaps-migration-test';

let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

const RISE: ElementAnimation = { presetId: 'rise-in', params: {} };
const FADE_HALF_SECOND: ElementAnimation = { presetId: 'fade-in', params: { duration: 0.5 } };
const STILL: ElementAnimation = { presetId: null, params: {} };
const FADE_OUT: ElementAnimation = { presetId: 'fade-out', params: { duration: 0.4 } };

const RISE_KEYFRAMES = `@keyframes tscaps-rise-in {
  from {
    opacity: var(--entrance-fade);
    transform: translateY(var(--entrance-rise));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`;

const FADE_KEYFRAMES = `@keyframes tscaps-fade-in {
  from {
    opacity: var(--entrance-fade);
  }
  to {
    opacity: 1;
  }
}`;

/** A word's own `rise-in`, then a declaration typed by hand, as v27 stored them. */
const WORD_RISE_V27 = `--entrance-rise: 0.2em;
--entrance-fade: 0;
--entrance-duration: 0.32s;
animation: tscaps-rise-in var(--entrance-duration) var(--on-word-being-narrated-starts) cubic-bezier(0.22, 1, 0.36, 1) both;
&::before, &::after, & .letter::before, & .letter::after, & .letter {
  animation: none;
}

${RISE_KEYFRAMES}

color: gold;`;

/** A caption's `fade-in` for its words, tuned to half a second, as v27 stored it. */
const CAPTION_WORDS_FADE_V27 = `& :where(.word) {
  --entrance-fade: 0;
  --entrance-duration: 0.5s;
  animation: tscaps-fade-in var(--entrance-duration) var(--on-word-being-narrated-starts) ease both;
}
& :where(.word)::before, & :where(.word)::after, & :where(.word) .letter::before, & :where(.word) .letter::after, & :where(.word) .letter {
  animation: none;
}

${FADE_KEYFRAMES}`;

/** A caption told not to enter at all, as v27 stored it. */
const CAPTION_STILL_V27 = `animation: none;
&::before, &::after, & .line::before, & .line::after, & .line {
  animation: none;
}`;

/** A sheet's `fade-in` for every word, as v27 compiled it. */
const SHEET_WORDS_FADE_V27 = `.word {
  --entrance-fade: 0;
  --entrance-duration: 0.18s;
  animation: tscaps-fade-in var(--entrance-duration) var(--on-word-being-narrated-starts) ease both;
}

.word::before, .word::after, .word .letter::before, .word .letter::after, .word .letter {
  animation: none;
}

${FADE_KEYFRAMES}`;

function storedStyles(): Record<string, unknown> {
  return {
    w1: { kind: 'word', animations: { self: RISE }, css: WORD_RISE_V27 },
    s1: { kind: 'segment', animations: { words: FADE_HALF_SECOND }, css: CAPTION_WORDS_FADE_V27 },
    s2: { kind: 'segment', animations: { self: STILL }, css: CAPTION_STILL_V27 },
  };
}

function migratedStyles(stored: Record<string, unknown>): ElementStyles {
  const data = migration.migrate({ version: 27, elementStyles: stored });
  return ElementStyles.fromSnapshot(data.elementStyles as ElementStylesSnapshot);
}

function cssOf(styles: ElementStyles, elementId: string): string {
  return styles.get(elementId)?.css ?? '';
}

/** `styles` with one more answer given to a word, written the way the panel writes it. */
function given(styles: ElementStyles, wordId: string, scope: ElementAnimationScope, animation: ElementAnimation): ElementStyles {
  const written = css.animationCssWriter.rewrite(styles.get(wordId)?.css ?? '', 'word', scope, undefined, animation);
  return styles.withAnimation(wordId, 'word', scope, animation, written);
}

function stylesheet(styles: ElementStyles, sheet = SheetAnimationSet.empty()): string {
  const scoper = new CssScoper();
  return [
    `@layer ${CssLayer.FRAMEWORK} {\n${scoper.scope(FROZEN_FRAME_CSS, `.${SCOPE}`)}\n}`,
    scoper.scope(css.layeredCaptionCssBuilder.build('.word { color: white }', sheet, styles), `.${SCOPE}`),
  ].join('\n');
}

/** A word `sinceNarrated` into its narration, `untilEnd` before its caption leaves. */
function wordAt(wordId: string, segmentId: string, sinceNarrated: number, untilEnd: number): string {
  return `<div class="segment" data-tscaps-el="${segmentId}" style="--on-segment-starts: -1s; `
    + `--on-segment-ends: ${untilEnd}s; --segment-duration: 4s">`
    + `<span class="word" data-tscaps-el="${wordId}" id="w" style="--on-word-being-narrated-starts: ${-sinceNarrated}s">a</span>`
    + '</div>';
}

async function paintedWord(sheetCss: string, markup: string): Promise<string> {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>${sheetCss}</style><div class="${SCOPE}">${markup}</div>`);
    return await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('w')!);
      return `${style.opacity}|${style.transform}|${style.color}`;
    });
  } finally {
    await page.close();
  }
}

describe('an element\'s entrance saved at v27', () => {
  it('is still the block its record writes, so the panel keeps deciding it', () => {
    const styles = migratedStyles(storedStyles());
    expect(css.animationCssWriter.isTakenOver(cssOf(styles, 'w1'), 'word', ElementAnimationScope.SELF, RISE)).toBe(false);
    expect(css.animationCssWriter.isTakenOver(cssOf(styles, 's1'), 'segment', ElementAnimationScope.WORDS, FADE_HALF_SECOND)).toBe(false);
    expect(css.animationCssWriter.isTakenOver(cssOf(styles, 's2'), 'segment', ElementAnimationScope.SELF, STILL)).toBe(false);
  });

  it('was not before the step, which is what the step is for', () => {
    expect(css.animationCssWriter.isTakenOver(WORD_RISE_V27, 'word', ElementAnimationScope.SELF, RISE)).toBe(true);
  });

  it('paints exactly what it painted, the declarations typed beside it included', async () => {
    const before = ElementStyles.fromSnapshot(storedStyles() as ElementStylesSnapshot);
    const after = migratedStyles(storedStyles());
    for (const [since, until] of [[0, 3], [0.1, 3], [0.2, 3], [2, 3]] as const) {
      const markup = wordAt('w1', 's9', since, until);
      expect(await paintedWord(stylesheet(after), markup)).toBe(await paintedWord(stylesheet(before), markup));
    }
  });

  it('plays an exit given afterwards to the same element', async () => {
    const styles = given(migratedStyles(storedStyles()), 'w1', ElementAnimationScope.EXIT, FADE_OUT);
    const [opacity] = (await paintedWord(stylesheet(styles), wordAt('w1', 's9', 0.1, 3))).split('|');
    const [leaving] = (await paintedWord(stylesheet(styles), wordAt('w1', 's9', 5, 0.2))).split('|');
    expect(Number(opacity)).toBeLessThan(1);
    expect(Number(leaving)).toBeLessThan(1);
  });

  it('plays beside an exit one of the caption\'s words is given afterwards', async () => {
    const styles = given(migratedStyles(storedStyles()), 'w2', ElementAnimationScope.EXIT, FADE_OUT);
    const arriving = (await paintedWord(stylesheet(styles), wordAt('w2', 's1', 0.1, 3))).split('|')[0];
    expect(Number(arriving)).toBeLessThan(1);
  });

  it('is left as it was once edited by hand, still rendering and still read as taken over', () => {
    const edited = WORD_RISE_V27.replace('--entrance-rise: 0.2em;', '--entrance-rise: 0.9em;');
    const data = migration.migrate({ version: 27, elementStyles: { w1: { kind: 'word', animations: { self: RISE }, css: edited } } });
    expect((data.elementStyles as Record<string, { css: string }>).w1!.css).toBe(edited);
  });
});

describe('a sheet\'s entrance saved at v27', () => {
  function migratedSheet(answer: Record<string, unknown>): SheetAnimationSet {
    const data = migration.migrate({ version: 27, sheets: [{ id: 'sh1', animations: { words: answer } }] });
    return SheetAnimationSet.fromSnapshot((data.sheets as Array<{ animations: unknown }>)[0]!.animations);
  }

  const replaced = { kind: 'replaced', animation: { presetId: 'fade-in', params: {} }, css: SHEET_WORDS_FADE_V27 };

  it('paints exactly what it painted', async () => {
    const markup = wordAt('w9', 's9', 0.05, 3);
    const before = SheetAnimationSet.fromSnapshot({ words: replaced });
    expect(await paintedWord(stylesheet(ElementStyles.empty(), migratedSheet(replaced)), markup))
      .toBe(await paintedWord(stylesheet(ElementStyles.empty(), before), markup));
  });

  it('plays beside an exit one word is given afterwards', async () => {
    const styles = given(ElementStyles.empty(), 'w1', ElementAnimationScope.EXIT, FADE_OUT);
    const arriving = (await paintedWord(stylesheet(styles, migratedSheet(replaced)), wordAt('w1', 's9', 0.05, 3))).split('|')[0];
    expect(Number(arriving)).toBeLessThan(1);
  });

  it('leaves a tuning answer, which writes no animation, exactly as it was', () => {
    const tuned = { kind: 'tuned', values: { '--entrance-duration': { kind: 'number', amount: 0.4, unit: 's' } }, css: '.word {\n  --entrance-duration: 0.4s;\n}' };
    const data = migration.migrate({ version: 27, sheets: [{ id: 'sh1', animations: { words: tuned } }] });
    expect((data.sheets as Array<{ animations: { words: unknown } }>)[0]!.animations.words).toEqual(tuned);
  });
});

describe('a project with caption tracks', () => {
  it('has each track\'s elements and sheets stepped the same way', () => {
    const data = migration.migrate({
      version: 27,
      captionTracks: [{ id: 't1', elementStyles: { w1: { kind: 'word', animations: { self: RISE }, css: WORD_RISE_V27 } }, sheets: [] }],
    });
    const track = (data.captionTracks as Array<{ elementStyles: unknown }>)[0]!;
    const styles = ElementStyles.fromSnapshot(track.elementStyles as ElementStylesSnapshot);
    expect(css.animationCssWriter.isTakenOver(cssOf(styles, 'w1'), 'word', ElementAnimationScope.SELF, RISE)).toBe(false);
  });

  it('leaves a project with nothing animated as it was', () => {
    const stored = { version: 27, elementStyles: { w1: { kind: 'word', css: 'color: gold;' } }, sheets: [{ id: 'sh1' }] };
    expect(migration.migrate(stored)).toEqual(stored);
  });
});
