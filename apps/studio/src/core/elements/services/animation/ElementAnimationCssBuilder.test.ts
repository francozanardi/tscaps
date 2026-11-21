import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import {
  BaselineCssComposer,
  CssFragmentParser,
  CssLayer,
  CssMinifier,
  CssScoper,
  FROZEN_FRAME_CSS,
} from '@tscaps/engine/advanced';
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
import { TestCaptionCss } from '@core/captions/testing/TestCaptionCss';

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
const EXIT_CLOCK = '--on-segment-ends';
const SEGMENT_DURATION = '--segment-duration';

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

/** One end of a word's life: the scope it is given at, the clock that end runs on, and the playheads it is read at. */
interface WordEnd {
  readonly scope: ElementAnimationScope;
  readonly clock: string;
  /** Each frame's clock reading: how far the playhead sits from the moment that end anchors to. */
  readonly offsets: ReadonlyArray<string>;
}

const ENTERING: WordEnd = { scope: ElementAnimationScope.SELF, clock: CLOCK, offsets: ['0s', '-0.05s', '-0.1s', '-0.2s', '-0.3s'] };
// The caption ends that far ahead of each frame; a caption long enough
// that no exit is cut to half of it.
const LEAVING: WordEnd = { scope: ElementAnimationScope.EXIT, clock: EXIT_CLOCK, offsets: ['0.6s', '0.3s', '0.2s', '0.1s', '0.05s'] };

/** Paints one word moving this way across one end of its life, and reads back what moved. */
async function framesOf(animation: ElementAnimation, pseudo?: string, end: WordEnd = ENTERING): Promise<string> {
  const styles = ElementStyles.empty()
    .withAnimation('w1', 'word', end.scope, animation, entranceCssWriter.rewrite('', 'word', end.scope, undefined, animation));
  const captionCss = new CssScoper().scope(
    new TestCaptionCss().layeredCaptionCssBuilder.build('.word { color: white }', SheetAnimationSet.empty(), styles),
    `.${SCOPE}`,
  );
  const stylesheet = [
    new BaselineCssComposer().composeOptional({ decorations: true, videoFrame: true, isolation: true }),
    `@layer ${CssLayer.FRAMEWORK} {\n${new CssScoper().scope(FROZEN_FRAME_CSS, `.${SCOPE}`)}\n}`,
    captionCss,
  ].join('\n');
  const markup = end.offsets
    .map((offset, index) => `<span class="word" data-tscaps-el="w1" id="s${index}" style="${end.clock}: ${offset}; ${SEGMENT_DURATION}: 4s">a</span>`)
    .join('');

  const page = await browser.newPage();
  try {
    await page.setContent(`<style>${stylesheet}</style><div class="${SCOPE}">${markup}</div>`);
    return await page.evaluate(({ count, part }) => Array.from({ length: count }, (_unused, index) => {
      const style = getComputedStyle(document.getElementById(`s${index}`)!, part ?? null);
      return `${style.transform}|${style.translate}|${style.scale}|${style.opacity}|${style.textShadow}`;
    }).join(' '), { count: end.offsets.length, part: pseudo });
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
      .toContain('--word-entrance-animation: none;');
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
  // A pan travels from one edge of the picture to the other, so where it
  // starts or ends really is at zero: the value shipped, not a missing one.
  const SHIPPED_AT_AN_EDGE: ReadonlySet<string> = new Set([
    'layer-pan-right-camera · start-x',
    'layer-pan-left-camera · end-x',
  ]);

  it.each(catalog.all().map((preset) => [preset.id, preset] as const))(
    'shows what its entrance ships it at: %s',
    (_id, preset) => {
      for (const control of preset.controls) {
        expect(control.defaultValue).toBeDefined();
        if (control.type === 'number' && !SHIPPED_AT_AN_EDGE.has(`${preset.id} · ${control.id}`)) {
          expect(control.defaultValue).not.toBe(0);
        }
      }
    },
  );

  it('renders the same whether the shipped value is recorded or left out', async () => {
    const control = catalog.byId('wobble-in')!.controls.find((candidate) => candidate.id === 'swing')!;
    expect(await framesOf(entranceOf('wobble-in')))
      .toBe(await framesOf(entranceOf('wobble-in', { swing: control.defaultValue })));
  }, 60_000);
});

describe('every field of every caption entrance', () => {
  const fields = catalog.forClock('word', CLOCK).flatMap((preset) => preset.controls.map((control) => [preset.id, control] as const));

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

describe('every field of every caption exit', () => {
  const fields = catalog.forClock('word', EXIT_CLOCK).flatMap((preset) => preset.controls.map((control) => [preset.id, control] as const));

  it('exists for every caption kind', () => {
    for (const kind of ['segment', 'word', 'decoration'] as const) {
      expect(catalog.forClock(kind, EXIT_CLOCK).map((preset) => preset.id)).toEqual(
        ['fade-out', 'rise-out', 'slide-out', 'scale-out', 'pop-out'],
      );
    }
  });

  it.each(fields.map(([id, control]) => [`${id} · ${control.label}`, id, control] as const))(
    'changes what renders when it moves: %s',
    async (_name, presetId, control) => {
      const [low, high] = endsOf(control);
      expect(await framesOf(entranceOf(presetId, { [control.id]: low }), undefined, LEAVING))
        .not.toBe(await framesOf(entranceOf(presetId, { [control.id]: high }), undefined, LEAVING));
    },
    60_000,
  );
});
