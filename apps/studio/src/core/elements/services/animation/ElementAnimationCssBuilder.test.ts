import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import {
  BaselineCssComposer,
  CssBlockSealer,
  CssFragmentParser,
  CssKeyframeNamespacer,
  CssLayer,
  CssMinifier,
  CssScoper,
  FROZEN_FRAME_CSS,
} from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';

/**
 * What an entrance promises, asked of a browser.
 *
 * The build already refuses a field naming a property the entrance
 * never uses, but "the CSS mentions it" and "dragging it changes the
 * picture" are different claims, and only the second is what the user
 * is promised.
 */

const SCOPE = 'tscaps-render-test';
const CLOCK = '--on-word-being-narrated-starts';

const catalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
const entranceCssBuilder = new ElementAnimationCssBuilder(
  catalog,
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
);
const entranceCssWriter = new ElementAnimationCssWriter(entranceCssBuilder);

let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

function entranceOf(presetId: string, params: Record<string, ElementControlValue> = {}): ElementAnimation {
  return { presetId, params };
}

/** Paints one word entering this way across its window, and reads back what moved. */
async function framesOf(entrance: ElementAnimation, pseudo?: string): Promise<string> {
  const offsets = ['0s', '-0.05s', '-0.1s', '-0.2s', '-0.3s'];
  const styles = ElementStyles.empty()
    .withAnimation('w1', 'word', ElementAnimationScope.SELF, entrance, entranceCssWriter.rewrite('', 'word', ElementAnimationScope.SELF, undefined, entrance));
  const captionCss = new CssScoper().scope(
    new LayeredCaptionCssBuilder(
      new CssKeyframeNamespacer(),
      new CssMinifier(),
      new CssBlockSealer(),
    ).build('.word { color: white }', SheetAnimationSet.empty(), styles),
    `.${SCOPE}`,
  );
  const stylesheet = [
    new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true, isolation: true }),
    `@layer ${CssLayer.FRAMEWORK} {\n${new CssScoper().scope(FROZEN_FRAME_CSS, `.${SCOPE}`)}\n}`,
    captionCss,
  ].join('\n');
  const markup = offsets
    .map((offset, index) => `<span class="word" data-tscaps-el="w1" id="s${index}" style="${CLOCK}: ${offset}">a</span>`)
    .join('');

  const page = await browser.newPage();
  try {
    await page.setContent(`<style>${stylesheet}</style><div class="${SCOPE}">${markup}</div>`);
    return await page.evaluate(({ count, part }) => Array.from({ length: count }, (_unused, index) => {
      const style = getComputedStyle(document.getElementById(`s${index}`)!, part ?? null);
      return `${style.transform}|${style.opacity}`;
    }).join(' '), { count: offsets.length, part: pseudo });
  } finally {
    await page.close();
  }
}

/** The two ends of a field, which have to look different from each other. */
function endsOf(control: ElementControl): readonly [ElementControlValue, ElementControlValue] {
  if (control.type === 'select') return ['negative', 'positive'];
  return [control.min ?? 0, control.max ?? 1];
}

describe('an entrance built from what was picked', () => {
  it('says the element does not enter when that is the answer', () => {
    expect(entranceCssBuilder.build({ presetId: null, params: {} }, 'word', ElementAnimationScope.SELF))
      .toContain('animation: none;');
  });

  it('says nothing for an entrance the catalogue no longer offers', () => {
    expect(entranceCssBuilder.build(entranceOf('gone-in'), 'word', ElementAnimationScope.SELF)).toBe('');
  });

  it('anchors to the clock the element\'s kind runs on', () => {
    expect(entranceCssBuilder.build(entranceOf('rise-in'), 'word', ElementAnimationScope.SELF)).toContain('--on-word-being-narrated-starts');
    expect(entranceCssBuilder.build(entranceOf('rise-in'), 'segment', ElementAnimationScope.SELF)).toContain('--on-segment-starts');
  });
});

describe('an entrance that paints a box of its own', () => {
  // Applying an entrance silences the element's generated boxes, so that
  // a box a template was moving does not keep moving under a new answer.
  // An entrance bringing its own box has to survive that, or it paints
  // an animation nothing plays.
  it('moves that box rather than being silenced with the rest', async () => {
    const frames = await framesOf(entranceOf('flash-in'), '::after');
    expect(new Set(frames.split(' '))).not.toHaveLength(1);
  }, 60_000);

  /**
   * Order alone would already leave the box moving, since its rule is
   * written after the silencing and the two weigh the same. This is
   * about what the CSS says rather than what it does: a user reads it,
   * and a box told to stop on one line and to move on the next reads as
   * a mistake in whichever of the two they find first.
   */
  it('does not tell that box to stop and then move', () => {
    const css = entranceCssBuilder.build(entranceOf('flash-in'), 'word', ElementAnimationScope.SELF);
    const silencing = css.slice(0, css.indexOf('&::after {\n'));
    expect(silencing).not.toContain('&::after');
    expect(silencing).toContain('&::before');
  });

  it('is offered only for the kind the library wrote it for', () => {
    expect(catalog.forKind('word').map((preset) => preset.id)).toContain('flash-in');
    expect(catalog.forKind('decoration').map((preset) => preset.id)).not.toContain('flash-in');
  });

  // A decoration runs on the word's clock, so an entrance available for
  // one and not the other cannot be told apart by the clock alone.
  it('is refused for a kind it was never built for', () => {
    const preset = catalog.byId('flash-in')!;
    expect(() => catalog.declarationsFor(preset, '--on-segment-starts')).toThrow();
  });
});

describe('a field nobody has moved yet', () => {
  // A field with nothing recorded against it has to show the value the
  // element is actually entering with. Showing zero instead reports a
  // choice the user never made, over an entrance that is not at zero.
  it.each(catalog.all().map((preset) => [preset.id, preset] as const))(
    'shows what its entrance ships it at: %s',
    (_id, preset) => {
      for (const control of preset.controls) {
        expect(control.defaultValue).toBeDefined();
        if (control.type === 'number') expect(control.defaultValue).not.toBe(0);
      }
    },
  );

  it('renders the same whether the shipped value is recorded or left out', async () => {
    const control = catalog.byId('wobble-in')!.controls.find((candidate) => candidate.id === 'swing')!;
    expect(await framesOf(entranceOf('wobble-in')))
      .toBe(await framesOf(entranceOf('wobble-in', { swing: control.defaultValue })));
  }, 60_000);
});

describe('every field of every entrance', () => {
  const fields = catalog.all().flatMap((preset) => preset.controls.map((control) => [preset.id, control] as const));

  it.each(fields.map(([id, control]) => [`${id} · ${control.label}`, id, control] as const))(
    'changes what renders when it moves: %s',
    async (_name, presetId, control) => {
      const [low, high] = endsOf(control);
      expect(await framesOf(entranceOf(presetId, { [control.id]: low })))
        .not.toBe(await framesOf(entranceOf(presetId, { [control.id]: high })));
    },
    60_000,
  );
});
