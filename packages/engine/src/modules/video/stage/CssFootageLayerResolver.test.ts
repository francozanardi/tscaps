import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';

/**
 * How a footage layer is drawn at a moment, asked of the browser that
 * resolves its stylesheet.
 *
 * Every answer is a promise about what a CSS engine makes of the stage:
 * where a box lands, what a paused animation holds at a clock, how
 * `transform`, `clip-path` and `filter` come back. So Chromium resolves
 * the stage and the resolver reads it, with nothing in between.
 */

const FIXTURE_ID = 'virtual:footage-layer-resolver-fixture';
const FIXTURE_SOURCE = `
  export { CssFootageLayerResolverFactory } from '@modules/video/stage/CssFootageLayerResolverFactory';
  export { ComputedFootageLayerStateReader } from '@modules/video/stage/ComputedFootageLayerStateReader';
  export { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';
  export { CssFootageLayerClockFactory } from '@modules/video/stage/CssFootageLayerClockFactory';
  export { CssFootageClockUseInspector } from '@modules/video/stage/CssFootageClockUseInspector';
  export { VariableFootageLayerClock } from '@modules/video/stage/VariableFootageLayerClock';
`;
const FRAME = { width: 1000, height: 2000 };

/** A layer as the page builds it: its id and its stretch of the output; its source never matters to how it is drawn. */
interface LayerSpec {
  readonly id: string;
  readonly outputStartSec: number;
  readonly outputEndSec: number;
}

/** What one layer resolved to at one moment. */
interface Answer {
  readonly id: string;
  readonly state: FootageLayerFrameState;
}

let browser: Browser;
let bundle: string;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
  page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: bundle });
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'footage-layer-resolver-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '../..') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        // An app build tree-shakes an entry's exports away, and this
        // entry is nothing but exports.
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

/**
 * What one resolver, opened on `layers` and `css`, answers at each
 * moment in turn, `waitMs` of wall-clock time apart.
 */
async function resolvedAt(
  layers: ReadonlyArray<LayerSpec>,
  css: string,
  moments: ReadonlyArray<number>,
  frame: { width: number; height: number } = FRAME,
  waitMs = 0,
): Promise<Answer[][]> {
  return page.evaluate(async ({ layers, css, moments, frame, waitMs }) => {
    const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
    const factory = new fixture.CssFootageLayerResolverFactory!(
      new fixture.ComputedFootageLayerStateReader!(),
      new fixture.FootageStageBaselineCss!(),
      new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
    ) as { open(...args: unknown[]): { resolveAt(t: number): Array<{ layer: { id: string }; state: unknown }>; dispose(): void } };
    const footage = layers.map((layer) => ({
      ...layer,
      source: { kind: 'image', blob: new Blob() },
      sourceStartSec: 0,
      sourcePassSec: Infinity,
    }));
    const resolver = factory.open(footage, { css, frameWidth: frame.width, frameHeight: frame.height });
    const answers: Answer[][] = [];
    for (const moment of moments) {
      if (answers.length > 0 && waitMs > 0) await new Promise((done) => setTimeout(done, waitMs));
      answers.push(resolver.resolveAt(moment).map(({ layer, state }) => ({ id: layer.id, state: state as FootageLayerFrameState })));
    }
    resolver.dispose();
    return answers;
  }, { layers, css, moments, frame, waitMs }) as Promise<Answer[][]>;
}

/**
 * What `layers` styled by `css` resolve to at each moment, by the clock
 * the stylesheet is given (`picked`) and by one that writes the clock's
 * variables at every moment (`written`), which holds for any stylesheet.
 */
async function resolvedByBothClocks(
  layers: ReadonlyArray<LayerSpec>,
  css: string,
  moments: ReadonlyArray<number>,
): Promise<{ picked: Answer[][]; written: Answer[][] }> {
  return page.evaluate(({ layers, css, moments, frame }) => {
    const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
    type Factory = { open(...args: unknown[]): { resolveAt(t: number): Array<{ layer: { id: string }; state: unknown }>; dispose(): void } };
    const factoryWith = (clocks: unknown): Factory => new fixture.CssFootageLayerResolverFactory!(
      new fixture.ComputedFootageLayerStateReader!(),
      new fixture.FootageStageBaselineCss!(),
      clocks,
    ) as Factory;
    const footage = layers.map((layer) => ({ ...layer, source: { kind: 'image', blob: new Blob() }, sourceStartSec: 0, sourcePassSec: Infinity }));
    const answersOf = (factory: Factory): Answer[][] => {
      const resolver = factory.open(footage, { css, frameWidth: frame.width, frameHeight: frame.height });
      const answers = moments.map((moment) => resolver.resolveAt(moment).map(({ layer, state }) => ({ id: layer.id, state: state as FootageLayerFrameState })));
      resolver.dispose();
      return answers;
    };
    return {
      picked: answersOf(factoryWith(new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()))),
      written: answersOf(factoryWith({ open: () => new fixture.VariableFootageLayerClock!() })),
    };
  }, { layers, css, moments, frame: FRAME }) as Promise<{ picked: Answer[][]; written: Answer[][] }>;
}

/** Every number in `actual` is within a ten-thousandth of the one at the same place in `expected`, and everything else is equal. */
function expectSameStates(actual: unknown, expected: unknown, path = 'answers'): void {
  if (typeof actual === 'number' && typeof expected === 'number') {
    expect(Math.abs(actual - expected), `${path}: ${actual} against ${expected}`).toBeLessThan(1e-4);
    return;
  }
  if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object') {
    expect(Object.keys(actual), path).toEqual(Object.keys(expected));
    for (const key of Object.keys(expected)) {
      expectSameStates((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], `${path}.${key}`);
    }
    return;
  }
  expect(actual, path).toEqual(expected);
}

async function stateOf(css: string, outputSec = 1, layer: LayerSpec = layerOn('clip')): Promise<FootageLayerFrameState> {
  return (await resolvedAt([layer], css, [outputSec]))[0]![0]!.state;
}

const layerOn = (id: string, outputStartSec = 0, outputEndSec = 4): LayerSpec => ({ id, outputStartSec, outputEndSec });
const box = (id: string, declarations: string) => `[data-tscaps-el="${id}"] { ${declarations} }`;

function expectAtRest(state: FootageLayerFrameState): void {
  expect(state.opacity).toBe(1);
  expect(state.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  expect(state.blur).toBe(0);
  expect(state.brightness).toBe(1);
  expect(state.clipInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
}

function expectRect(actual: { x: number; y: number; width: number; height: number } | null, expected: { x: number; y: number; width: number; height: number }): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual![key]).toBeCloseTo(expected[key], 4);
}

describe('which layers are answered', () => {
  it('answers the layers active at the moment, bottom to top in the order given, and none other', async () => {
    const layers = [layerOn('under', 0, 4), layerOn('later', 5, 8), layerOn('over', 1, 3)];

    const [before, both, after] = await resolvedAt(layers, '', [0.5, 2, 4.5]);

    expect(before!.map((answer) => answer.id)).toEqual(['under']);
    expect(both!.map((answer) => answer.id)).toEqual(['under', 'over']);
    expect(after).toEqual([]);
  });

  it('covers the whole frame, at rest, with a box nothing places', async () => {
    const state = await stateOf('');

    expectRect(state.assetRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(state.fit).toBe('cover');
    expect(state.cornerRadius).toBe(0);
    expect(state.videoRect).toBeNull();
    expectAtRest(state);
  });

  it('answers a moment asked again with the same answer, and resolves any other afresh', async () => {
    const same = await page.evaluate(() => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
      const factory = new fixture.CssFootageLayerResolverFactory!(
        new fixture.ComputedFootageLayerStateReader!(),
        new fixture.FootageStageBaselineCss!(),
        new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
      ) as { open(...args: unknown[]): { resolveAt(t: number): Array<{ state: { opacity: number } }>; dispose(): void } };
      const layer = { id: 'clip', source: { kind: 'image', blob: new Blob() }, outputStartSec: 0, outputEndSec: 4, sourceStartSec: 0, sourcePassSec: 0 };
      const resolver = factory.open([layer], {
        css: '[data-tscaps-el="clip"] { animation: fade 1s linear var(--on-layer-starts) both; } @keyframes fade { from { opacity: 0; } }',
        frameWidth: 100,
        frameHeight: 100,
      });
      const first = resolver.resolveAt(0.5);
      const again = resolver.resolveAt(0.5);
      const next = resolver.resolveAt(0.25);
      resolver.dispose();
      return { identical: first === again, first: first[0]!.state.opacity, next: next[0]!.state.opacity };
    });

    expect(same.identical).toBe(true);
    expect(same.first).toBeCloseTo(0.5, 3);
    expect(same.next).toBeCloseTo(0.25, 3);
  });

  it('takes a time a rounding error away from a moment asked as that same moment', async () => {
    const same = await page.evaluate(() => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
      const factory = new fixture.CssFootageLayerResolverFactory!(
        new fixture.ComputedFootageLayerStateReader!(),
        new fixture.FootageStageBaselineCss!(),
        new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
      ) as { open(...args: unknown[]): { resolveAt(t: number): unknown[]; dispose(): void } };
      const layer = { id: 'clip', source: { kind: 'image', blob: new Blob() }, outputStartSec: 0, outputEndSec: 4, sourceStartSec: 0, sourcePassSec: 0 };
      const resolver = factory.open([layer], { css: '', frameWidth: 100, frameHeight: 100 });
      const asked = 1.3;
      // The same time after going through another timeline and back: 2.6 added, then taken away.
      const roundTripped = (asked + 2.6) - 2.6;
      const first = resolver.resolveAt(asked);
      const again = resolver.resolveAt(roundTripped);
      resolver.dispose();
      return { differs: asked !== roundTripped, identical: first === again };
    });

    expect(same).toEqual({ differs: true, identical: true });
  });

  it('resolves a length written off the clock afresh at every moment, and the same again when a moment comes back', async () => {
    const css = box('clip', '--clip-left: calc(var(--on-layer-starts) / -1s * 100px); --clip-top: 0px; --clip-width: 500px; --clip-height: 1000px; --clip-radius: calc(var(--on-layer-starts) / -1s * 10px);');

    const [early, later, earlyAgain] = await resolvedAt([layerOn('clip')], css, [1, 3, 1.00004]);

    expectRect(early![0]!.state.clipRect, { x: 0.1, y: 0, width: 0.5, height: 0.5 });
    expect(early![0]!.state.clipRadius).toBeCloseTo(0.01, 5);
    expectRect(later![0]!.state.clipRect, { x: 0.3, y: 0, width: 0.5, height: 0.5 });
    expect(later![0]!.state.clipRadius).toBeCloseTo(0.03, 5);
    expectRect(earlyAgain![0]!.state.clipRect, { x: 0.1, y: 0, width: 0.5, height: 0.5 });
  });

  it('takes its stage out of the document once disposed, and answers nothing after', async () => {
    const left = await page.evaluate(() => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
      const factory = new fixture.CssFootageLayerResolverFactory!(
        new fixture.ComputedFootageLayerStateReader!(),
        new fixture.FootageStageBaselineCss!(),
        new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
      ) as { open(...args: unknown[]): { resolveAt(t: number): unknown[]; dispose(): void } };
      const layer = { id: 'clip', source: { kind: 'image', blob: new Blob() }, outputStartSec: 0, outputEndSec: 4, sourceStartSec: 0, sourcePassSec: 0 };
      const before = document.body.childElementCount;
      const resolver = factory.open([layer], { css: '', frameWidth: 100, frameHeight: 100 });
      const answered = resolver.resolveAt(1).length;
      const mounted = document.body.childElementCount - before;
      resolver.dispose();
      return { answered, mounted, remaining: document.body.childElementCount - before, after: resolver.resolveAt(2).length };
    });

    expect(left).toEqual({ answered: 1, mounted: 1, remaining: 0, after: 0 });
  });
});

describe('a layer showing the source\'s own picture', () => {
  it('is marked so a stylesheet can address every such box at once', async () => {
    const opacities = await page.evaluate(() => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
      const factory = new fixture.CssFootageLayerResolverFactory!(
        new fixture.ComputedFootageLayerStateReader!(),
        new fixture.FootageStageBaselineCss!(),
        new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
      ) as { open(...args: unknown[]): { resolveAt(t: number): Array<{ state: { opacity: number } }>; dispose(): void } };
      const stretch = { outputStartSec: 0, outputEndSec: 4, sourceStartSec: 0, sourcePassSec: 0 };
      const resolver = factory.open(
        [{ id: 'own', source: { kind: 'source-picture' }, ...stretch }, { id: 'file', source: { kind: 'image', blob: new Blob() }, ...stretch }],
        { css: '.tscaps-footage-source-picture { opacity: 0.5; }', frameWidth: 100, frameHeight: 100 },
      );
      const answer = resolver.resolveAt(1).map(({ state }) => state.opacity);
      resolver.dispose();
      return answer;
    });

    expect(opacities).toEqual([0.5, 1]);
  });
});

describe('the clock', () => {
  const FADE_IN = box('clip', 'animation: fade 1s linear var(--on-layer-starts) both;') + ' @keyframes fade { from { opacity: 0; } }';

  it('freezes an animation delayed by the layer\'s start at the moment drawn', async () => {
    expect((await stateOf(FADE_IN, 0, layerOn('clip', 0, 4))).opacity).toBeCloseTo(0, 4);
    expect((await stateOf(FADE_IN, 2.5, layerOn('clip', 2, 6))).opacity).toBeCloseTo(0.5, 3);
    expectAtRest(await stateOf(FADE_IN, 3.5, layerOn('clip', 2, 6)));
  });

  it('ends an animation at the layer\'s end, and spans one over the layer\'s duration', async () => {
    const fadeOut = box('clip', 'animation: out 1s linear calc(var(--on-layer-ends) - 1s) forwards;') + ' @keyframes out { to { opacity: 0; } }';
    const across = box('clip', 'animation: dim var(--layer-duration) linear var(--on-layer-starts) both;') + ' @keyframes dim { from { opacity: 0; } }';

    expect((await stateOf(fadeOut, 3.5)).opacity).toBeCloseTo(0.5, 3);
    expect((await stateOf(across, 3, layerOn('clip', 2, 6))).opacity).toBeCloseTo(0.25, 3);
  });

  it('keeps every animation paused, whatever the stylesheet says', async () => {
    const running = `@layer later { ${box('clip', 'animation-play-state: running !important;')} } ${FADE_IN}`;

    const [first, second] = await resolvedAt([layerOn('clip')], running, [0.5, 0.25], FRAME, 300);

    expect(first![0]!.state.opacity).toBeCloseTo(0.5, 3);
    expect(second![0]!.state.opacity).toBeCloseTo(0.25, 3);
  });

  it('plays each layer\'s own rules on its own clock', async () => {
    const css = `${box('a', 'animation: fade 1s linear var(--on-layer-starts) both;')} ${box('b', 'animation: fade 1s linear var(--on-layer-starts) both;')} @keyframes fade { from { opacity: 0; } }`;

    const [[a, b] = []] = await resolvedAt([layerOn('a', 0, 4), layerOn('b', 0.5, 4)], css, [0.75]);

    expect(a!.state.opacity).toBeCloseTo(0.75, 3);
    expect(b!.state.opacity).toBeCloseTo(0.25, 3);
  });
});

describe('a stylesheet that reads the clock only to time its animations', () => {
  // A layer that starts two seconds in and stays four, sampled through its entrance, its rest and its exit.
  const LAYER = layerOn('clip', 2, 6);
  const MOMENTS = [2, 2.1, 2.25, 2.4999, 3, 4.2, 5.5, 5.7, 5.9, 5.9999, 3.3, 2.05];

  it('resolves every moment as it does with the clock written at every moment', async () => {
    const css = `
      ${box('clip', `
        --exit: leave 0.5s linear calc(var(--on-layer-ends) - 0.5s) forwards reverse;
        left: 100px; width: 400px;
        animation:
          enter 0.5s cubic-bezier(0.2, 0, 0, 1) var(--on-layer-starts) both,
          var(--exit),
          drift var(--layer-duration) linear var(--on-layer-starts) both,
          shake 0.3s steps(3) var(--on-layer-starts) infinite alternate;
      `)}
      @keyframes enter { from { opacity: 0; translate: 0 300px; } }
      @keyframes leave { from { filter: blur(40px); clip-path: inset(50% 0 0 0); } to { filter: blur(0px); clip-path: inset(0% 0 0 0); } }
      @keyframes drift { from { left: 100px; width: 400px; } to { left: 500px; width: 200px; } }
      @keyframes shake { from { rotate: -4deg; } to { rotate: 4deg; } }
    `;

    const { picked, written } = await resolvedByBothClocks([LAYER], css, MOMENTS);

    expectSameStates(picked, written);
    // Not a stylesheet that stands still: the two ends of the layer differ.
    expect(written[0]![0]!.state.opacity).toBeCloseTo(0, 3);
    expect(written[2]![0]!.state.assetRect.x).toBeGreaterThan(0.1);
    expect(written[8]![0]!.state.blur).toBeGreaterThan(0);
  });

  it('keeps each layer on its own clock, layers starting at different moments', async () => {
    const css = `
      .tscaps-footage-layer { animation: enter 1s linear var(--on-layer-starts) both; }
      @keyframes enter { from { opacity: 0; } }
    `;

    const { picked, written } = await resolvedByBothClocks([layerOn('early', 0, 4), layerOn('late', 2.5, 6)], css, [0.25, 2.6, 3, 3.75, 0.5]);

    expectSameStates(picked, written);
    expect(picked[1]!.map((answer) => [answer.id, Number(answer.state.opacity.toFixed(2))])).toEqual([['early', 1], ['late', 0.1]]);
  });

  it('leaves an animation that does not wait on the clock where it stands', async () => {
    const css = `
      ${box('clip', 'animation: held 2s linear -0.5s both, enter 1s linear var(--on-layer-starts) both;')}
      @keyframes held { from { translate: 0 0; } to { translate: 400px 0; } }
      @keyframes enter { from { opacity: 0; } }
    `;

    const { picked, written } = await resolvedByBothClocks([LAYER], css, MOMENTS);

    expectSameStates(picked, written);
    // A quarter of the way through, at every moment.
    for (const answers of picked) expect(answers[0]!.state.transform.e).toBeCloseTo(0.1, 4);
  });

  it('still follows an animation that takes the clock as its length, not as its delay', async () => {
    const css = `
      ${box('clip', 'animation: fill var(--on-layer-ends) linear -1s both;')}
      @keyframes fill { from { opacity: 0; } }
    `;

    const { picked, written } = await resolvedByBothClocks([LAYER], css, [2, 3, 4, 4.5]);

    expectSameStates(picked, written);
    // A second into however long is left: a quarter, a third, a half, two thirds.
    expect(picked.map((answers) => Number(answers[0]!.state.opacity.toFixed(3)))).toEqual([0.25, 0.333, 0.5, 0.667]);
  });
});

describe('what a box\'s CSS draws', () => {
  it('places the box where its geometry says, in pixels of the frame or shares of it', async () => {
    const state = await stateOf(box('clip', 'left: 100px; top: 10cqh; width: 50cqw; height: 300px; border-radius: 20px; object-fit: contain;'));

    expectRect(state.assetRect, { x: 0.1, y: 0.1, width: 0.5, height: 300 / FRAME.height });
    expect(state.cornerRadius).toBeCloseTo(20 / FRAME.width, 4);
    expect(state.fit).toBe('contain');
  });

  it('turns a transform about any origin into the same transform about the box\'s centre', async () => {
    const state = await stateOf(box('clip', 'left: 300px; top: 800px; width: 400px; height: 400px; transform: rotate(90deg); transform-origin: 0 0;'));

    expect(state.transform.a).toBeCloseTo(0, 6);
    expect(state.transform.b).toBeCloseTo(1, 6);
    expect(state.transform.c).toBeCloseTo(-1, 6);
    expect(state.transform.d).toBeCloseTo(0, 6);
    expect(state.transform.e * FRAME.width).toBeCloseTo(-400, 3);
    expect(state.transform.f * FRAME.height).toBeCloseTo(0, 3);
  });

  it('composes `translate`, `rotate` and `scale` with `transform`', async () => {
    const state = await stateOf(box('clip', 'width: 400px; height: 400px; translate: 10% 0; scale: 2; transform: translateX(50px);'));

    expect(state.transform.a).toBeCloseTo(2, 6);
    expect(state.transform.e * FRAME.width).toBeCloseTo(40 + 2 * 50, 3);
  });

  it('reads a fade, a clip, a blur and a brightness off whatever lengths they were written in', async () => {
    const state = await stateOf(box('clip', 'opacity: 0.4; clip-path: inset(10% 20px calc(25% + 10px) 0); filter: blur(40px) brightness(2);'));

    expect(state.opacity).toBeCloseTo(0.4, 4);
    expect(state.clipInset.top).toBeCloseTo(0.1, 4);
    expect(state.clipInset.right).toBeCloseTo(20 / FRAME.width, 4);
    expect(state.clipInset.bottom).toBeCloseTo(0.25 + 10 / FRAME.height, 4);
    expect(state.clipInset.left).toBe(0);
    expect(state.blur).toBeCloseTo(40 / Math.min(FRAME.width, FRAME.height), 4);
    expect(state.brightness).toBeCloseTo(2, 4);
  });

  it('reads the colour a box is filled with, and none where it is transparent', async () => {
    const white = await stateOf(box('clip', 'background-color: white;'));
    const black = await stateOf(box('clip', 'background-color: black;'));
    const clear = await stateOf(box('clip', 'background-color: rgb(255 0 0 / 0);'));
    const none = await stateOf(box('clip', ''));

    expect(white.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(black.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(clear.backgroundColor).toBeNull();
    expect(none.backgroundColor).toBeNull();
  });

  it('reads the radius of a blurred fill as a length of the stage, and none where unset', async () => {
    const filled = await stateOf(box('clip', '--picture-fill-blur: 4cqmin;'));
    const none = await stateOf(box('clip', ''));

    expect(filled.fillBlur).toBeCloseTo(0.04, 4);
    expect(none.fillBlur).toBe(0);
  });

  it('reads a clip rect and its radius off lengths of the stage, and none unless all four sides are set', async () => {
    const cut = await stateOf(box('clip', '--clip-left: 10%; --clip-top: 20%; --clip-width: 50%; --clip-height: 25%; --clip-radius: 2cqmin;'));
    const partial = await stateOf(box('clip', '--clip-left: 10%; --clip-top: 20%;'));

    expect(cut.clipRect!.x).toBeCloseTo(0.1, 4);
    expect(cut.clipRect!.y).toBeCloseTo(0.2, 4);
    expect(cut.clipRect!.width).toBeCloseTo(0.5, 4);
    expect(cut.clipRect!.height).toBeCloseTo(0.25, 4);
    expect(cut.clipRadius).toBeCloseTo(0.02, 4);
    expect(partial.clipRect).toBeNull();
  });

  it('reads a brightness written as a percentage, and none below zero', async () => {
    const dimmed = await stateOf(box('clip', 'filter: brightness(40%);'));
    const flashed = await stateOf(box('clip', 'filter: blur(2px) brightness(350%);'));

    expect(dimmed.brightness).toBeCloseTo(0.4, 4);
    expect(flashed.brightness).toBeCloseTo(3.5, 4);
  });

  it('re-frames the video where its `--video-*` lengths say, and leaves it be where they cover the frame', async () => {
    const moved = await stateOf(box('clip', '--video-left: 0px; --video-top: 50cqh; --video-width: 100cqw; --video-height: calc(100cqh - 1000px);'));
    const whole = await stateOf(box('clip', '--video-left: 0px; --video-top: 0px; --video-width: 100cqw; --video-height: 100cqh;'));
    const partial = await stateOf(box('clip', '--video-left: 0px; --video-top: 50cqh;'));

    expectRect(moved.videoRect, { x: 0, y: 0.5, width: 1, height: 0.5 });
    expect(whole.videoRect).toBeNull();
    expect(partial.videoRect).toBeNull();
  });

  it('draws the video over a box that asks for it, at its rect even where that covers the frame, and reads its corner', async () => {
    const corner = await stateOf(box('clip', '--video-above: 1; --video-radius: 4cqmin; --video-left: 50cqw; --video-top: 50cqh; --video-width: 40cqw; --video-height: 30cqh;'));
    const whole = await stateOf(box('clip', '--video-above: 1; --video-left: 0px; --video-top: 0px; --video-width: 100cqw; --video-height: 100cqh;'));
    const beneath = await stateOf(box('clip', '--video-left: 50cqw; --video-top: 50cqh; --video-width: 40cqw; --video-height: 30cqh;'));

    expect(corner.videoAbove).toBe(true);
    expectRect(corner.videoRect, { x: 0.5, y: 0.5, width: 0.4, height: 0.3 });
    expect(corner.videoCornerRadius).toBeCloseTo(0.04, 4);
    expectRect(whole.videoRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(beneath.videoAbove).toBe(false);
    const computed = await stateOf(box('clip', '--weight: 1; --video-above: calc(var(--weight) * 1); --video-left: 0px; --video-top: 0px; --video-width: 50cqw; --video-height: 50cqh;'));
    expect(computed.videoAbove).toBe(true);
    expect(beneath.videoCornerRadius).toBe(0);
  });

  it('reads a stage of the size it was given', async () => {
    const [[answer] = []] = await resolvedAt([layerOn('clip')], box('clip', 'width: 480px; height: 50cqh;'), [1], { width: 1920, height: 1080 });

    expectRect(answer!.state.assetRect, { x: 0, y: 0, width: 0.25, height: 0.5 });
  });

  it('reads where the picture sits in its box off `object-position`, from an edge or not', async () => {
    const centred = await stateOf('');
    const shares = await stateOf(box('clip', 'object-position: 0% 100%;'));
    const mixed = await stateOf(box('clip', 'object-position: calc(25% + 100px) 20px;'));
    const fromEdges = await stateOf(box('clip', 'object-position: right 10% bottom 200px;'));

    expect(centred.position).toEqual({ x: { share: 0.5, offset: 0 }, y: { share: 0.5, offset: 0 } });
    expect(shares.position).toEqual({ x: { share: 0, offset: 0 }, y: { share: 1, offset: 0 } });
    expect(mixed.position.x.share).toBeCloseTo(0.25, 6);
    expect(mixed.position.x.offset).toBeCloseTo(100 / FRAME.width, 6);
    expect(mixed.position.y).toEqual({ share: 0, offset: 20 / FRAME.height });
    expect(fromEdges.position.x.share).toBeCloseTo(0.9, 6);
    expect(fromEdges.position.x.offset).toBeCloseTo(0, 6);
    expect(fromEdges.position.y.share).toBeCloseTo(1, 6);
    expect(fromEdges.position.y.offset).toBeCloseTo(-200 / FRAME.height, 6);
  });
});

