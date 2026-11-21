import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import {
  type FootageStyle,
} from '@tscaps/engine';
import {
  CssBlockSealer,
  CssFragmentParser,
  CssKeyframeNamespacer,
  CssMinifier,
  type FootageLayerFrameState,
} from '@tscaps/engine/advanced';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { CssKeyframesLifter } from '@core/elements/services/css/CssKeyframesLifter';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter, type ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import { LineTypographyRereads } from '@core/elements/services/css/LineTypographyRereads';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { InsetShotLayerPlacement, ShotLayerPlacement, SplitShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotLayerStageBuilder } from '@core/shots/services/ShotLayerStageBuilder';
import { ShotFollowCameraWriter } from '@core/shots/services/ShotFollowCameraWriter';
import { ShotTransitionStyleWriter } from '@core/shots/services/ShotTransitionStyleWriter';
import { BUILTIN_SHOT_LAYER_STAGE_CSS } from '@core/shots/infrastructure/BuiltinShotLayerStageCss';
import type { ShotTransitionKind } from '@core/shots/domain/ShotTransition';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { OutputFrameCss } from '@core/output-frame/services/OutputFrameCss';
import { VideoPictureFootageBuilder } from '@core/shots/services/VideoPictureFootageBuilder';
import { RenderTimeMap } from '@tscaps/engine';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import { ShotFollowStager } from '@core/shots/services/ShotFollowStager';
import { ShotFollowCrop } from '@core/shots/services/ShotFollowCrop';
import { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';

/**
 * How a layer is drawn at a moment, as the engine resolves the
 * stylesheet written for it — what the preview and the export draw.
 *
 * Every answer here is a promise about what a CSS engine makes of the
 * stylesheet: where each layout puts the box and the video, what a
 * motion holds at a clock, what a hand-written declaration wins over.
 * So Chromium resolves it, through the engine's resolver, with nothing
 * between them; the stylesheet is written in Node, as the preview and
 * the export write it, every layer laid out by the fields a layout
 * writes.
 */

const FIXTURE_ID = 'virtual:shot-layer-stage-fixture';
const SRC = resolve(import.meta.dirname, '../../..');
const ENGINE = resolve(SRC, '../../../packages/engine/src/modules');
const FRAME = { width: 1000, height: 2000 };
const VERTICAL = { width: 1080, height: 1920 };
const HORIZONTAL = { width: 1920, height: 1080 };
const ENTRANCE = ElementAnimationScope.ENTRANCE;
const EXIT = ElementAnimationScope.EXIT;
const CAMERA = ElementAnimationScope.CAMERA;
const FULL: ShotLayerPlacement = { kind: 'full', fit: 'cover' };
const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: 1, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};
const SPLIT: ShotLayerPlacement = { kind: 'split', assetSide: 'end', assetRatio: 0.4, padding: 0, cornerRadius: 0.05, fit: 'contain' };

/** A layer as the resolver is asked about it: its id, where it shows on the output, and whether it shows the video's own picture. */
interface AskedLayer {
  readonly id: string;
  readonly outputStartSec: number;
  readonly outputEndSec: number;
  readonly showsVideo?: boolean;
}

const catalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
const writer = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
  catalog,
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
));
const stages = new ShotLayerStageBuilder(
  new ElementCssLayerBuilder(new CssKeyframeNamespacer(), new CssMinifier(), new CssBlockSealer(), new CssKeyframesLifter(), new LineTypographyRereads()),
  new ShotTransitionStyleWriter(BUILTIN_SHOT_LAYER_STAGE_CSS), BUILTIN_SHOT_LAYER_STAGE_CSS,
  new OutputFrameCss(),
  new ShotFollowCameraWriter(),
);
const ORIGINAL = OutputFrame.original();
const layouts = new TestShotLayerLayouts().writer;
// Where `INSET` rests on `FRAME`: 400 px square, centred.
const INSET_BOX = { x: 0.3, y: 0.4, width: 0.4, height: 0.2 };

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

/** The engine's resolver alone: its whole entry would drag its runtimes into a page that only reads styles. */
function fixturePlugin(): Plugin {
  const fixture = `\0${FIXTURE_ID}`;
  return {
    name: 'shot-layer-stage-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? fixture : null),
    load: (id) => {
      if (id === fixture) {
        return `export { CssFootageLayerResolverFactory } from '@modules/video/stage/CssFootageLayerResolverFactory';
export { ComputedFootageLayerStateReader } from '@modules/video/stage/ComputedFootageLayerStateReader';
export { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';
export { CssFootageLayerClockFactory } from '@modules/video/stage/CssFootageLayerClockFactory';
export { CssFootageClockUseInspector } from '@modules/video/stage/CssFootageClockUseInspector';`;
      }
      return null;
    },
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixturePlugin()],
    resolve: { alias: { '@modules': ENGINE } },
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

/** Each layer's style: the animations picked at its ends and its camera, written as the editor writes them, and CSS by hand after. */
function stylesOf(layers: ReadonlyArray<{
  id: string;
  entrance?: ElementAnimation;
  exit?: ElementAnimation;
  camera?: ElementAnimation;
  css?: string;
}>): ElementStyles {
  let styles = ElementStyles.empty();
  for (const layer of layers) {
    let css = '';
    for (const [scope, animation] of [[ENTRANCE, layer.entrance], [EXIT, layer.exit], [CAMERA, layer.camera]] as const) {
      if (animation === undefined) continue;
      css = writer.rewrite(css, 'layer', scope, undefined, animation);
      styles = styles.withAnimation(layer.id, 'layer', scope, animation, css);
    }
    if (layer.css !== undefined) styles = styles.withCss(layer.id, 'layer', css.length > 0 ? `${css}\n${layer.css}` : layer.css);
  }
  return styles;
}

/**
 * A stage of `FRAME`'s size, or `frame`'s, holding each layer laid out
 * by its placement, its own CSS after; each file square, or of
 * `assetAspectRatio` (null for not known).
 */
function stageOf(
  placements: Readonly<Record<string, ShotLayerPlacement>>,
  styles: ElementStyles,
  frame: { width: number; height: number } | null = FRAME,
  assetAspectRatio: number | null = 1,
): FootageStyle {
  let laidOut = styles;
  for (const [layerId, placement] of Object.entries(placements)) {
    const layoutCss = layouts.written(ElementStyles.empty(), layerId, placement).get(layerId)?.css ?? '';
    const ownCss = styles.get(layerId)?.css ?? '';
    laidOut = laidOut.withCss(layerId, 'layer', [layoutCss, ownCss].filter((css) => css.length > 0).join('\n'));
  }
  const staged = Object.keys(placements).map((layerId) => ({ layerId, assetAspectRatio }));
  return stages.build(staged, laidOut, frame, ORIGINAL);
}

/** A resolver the engine opens on the page, over these layers and this stylesheet. */
type PageResolver = { resolveAt(outputSec: number): Array<{ layer: { id: string }; state: unknown }>; dispose(): void };

/**
 * What one resolver, opened on the layers of the first ask and `style`,
 * answers for each ask, one after another, on one page: the state of
 * each layer asked, in the order asked.
 */
async function resolved(style: FootageStyle, asks: ReadonlyArray<{ outputSec: number; layers: ReadonlyArray<AskedLayer> }>): Promise<FootageLayerFrameState[][]> {
  return page.evaluate(({ style, asks }) => {
    const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => unknown> }).fixture;
    const factory = new fixture.CssFootageLayerResolverFactory!(
      new fixture.ComputedFootageLayerStateReader!(),
      new fixture.FootageStageBaselineCss!(),
      new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
    ) as { open(...args: unknown[]): PageResolver };
    const footage = asks[0]!.layers.map((layer) => ({
      ...layer,
      source: layer.showsVideo ? { kind: 'source-picture' } : { kind: 'image', blob: new Blob() },
      sourceStartSec: 0,
      sourcePassSec: 0,
    }));
    const resolver = factory.open(footage, style);
    const answers = asks.map(({ outputSec, layers }) => {
      const resolvedThen = resolver.resolveAt(outputSec);
      return layers.map((layer) => resolvedThen.find((entry) => entry.layer.id === layer.id)!.state);
    });
    resolver.dispose();
    return answers;
  }, { style, asks }) as Promise<FootageLayerFrameState[][]>;
}

async function stateAt(stage: FootageStyle, outputSec: number, layer: AskedLayer): Promise<FootageLayerFrameState> {
  return (await resolved(stage, [{ outputSec, layers: [layer] }]))[0]![0]!;
}

const layerOn = (id: string, outputStartSec = 0, outputEndSec = 4): AskedLayer => ({ id, outputStartSec, outputEndSec });

function expectAtRest(state: FootageLayerFrameState): void {
  expect(state.opacity).toBe(1);
  expect(state.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  expect(state.blur).toBe(0);
  expect(state.clipInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
}

function expectRect(actual: { x: number; y: number; width: number; height: number } | null, expected: { x: number; y: number; width: number; height: number } | null): void {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual![key]).toBeCloseTo(expected[key], 3);
}

describe('a layer at rest', () => {
  it.each([
    ['full screen', FULL, { x: 0, y: 0, width: 1, height: 1 }, null, 0],
    ['split screen', SPLIT, { x: 0, y: 0.6, width: 1, height: 0.4 }, { x: 0, y: 0, width: 1, height: 0.6 }, 0.05],
    ['picture in picture', INSET, INSET_BOX, null, 0.04],
  ] as const)(
    'lands where its layout puts it: %s',
    async (_name, placement, assetRect, videoRect, cornerRadius) => {
      const state = await stateAt(stageOf({ clip: placement }, ElementStyles.empty()), 1, layerOn('clip'));

      expectRect(state.assetRect, assetRect);
      expectRect(state.videoRect, videoRect);
      expect(state.fit).toBe(placement.fit);
      expect(state.cornerRadius).toBeCloseTo(cornerRadius, 4);
      expectAtRest(state);
    },
  );

  it('rests between its entrance and its exit, whatever motion it was given', async () => {
    const motions = ['fade', 'pop', 'slide', 'push', 'zoom-out', 'blur', 'wipe', 'spin'];
    const styles = stylesOf(motions.map((motion) => ({
      id: motion,
      entrance: { presetId: `layer-${motion}-entrance`, params: {} },
      exit: { presetId: `layer-${motion}-exit`, params: {} },
    })));
    const stage = stageOf(Object.fromEntries(motions.map((motion) => [motion, INSET])), styles);

    const [states] = await resolved(stage, [{ outputSec: 2, layers: motions.map((motion) => layerOn(motion)) }]);

    for (const state of states!) expectAtRest(state);
  });
});

describe('a file in a box of another shape', () => {
  it('fills the box around a fitted file with the file itself, blurred, or with black, and leaves it empty unless told', async () => {
    const at = (backdrop?: 'black' | 'blur') => stateAt(
      stageOf({ clip: { kind: 'full', fit: 'contain', ...(backdrop === undefined ? {} : { backdrop }) } }, ElementStyles.empty()),
      1,
      layerOn('clip'),
    );

    const blurred = await at('blur');
    expect(blurred.fillBlur).toBeCloseTo(0.04, 4);
    expect(blurred.backgroundColor).toBeNull();
    const black = await at('black');
    expect(black.fillBlur).toBe(0);
    expect(black.backgroundColor).toBe('rgb(0, 0, 0)');
    const empty = await at();
    expect(empty.fillBlur).toBe(0);
    expect(empty.backgroundColor).toBeNull();
  });

  it('crops a file filling its box where it is told, centred unless told', async () => {
    const cropped = await stateAt(stageOf({ clip: { kind: 'full', fit: 'cover', position: { x: 0, y: 1 } } }, ElementStyles.empty()), 1, layerOn('clip'));
    const centred = await stateAt(stageOf({ clip: FULL }, ElementStyles.empty()), 1, layerOn('clip'));

    expect(cropped.position.x.share).toBeCloseTo(0, 4);
    expect(cropped.position.y.share).toBeCloseTo(1, 4);
    expect(centred.position.x.share).toBeCloseTo(0.5, 4);
  });
});

describe('a layer coming in', () => {
  /** What a layer given only this entrance, at its defaults, is drawn as at `outputSec`. */
  async function entering(motion: string, outputSec: number, placement: ShotLayerPlacement = FULL): Promise<FootageLayerFrameState> {
    const styles = stylesOf([{ id: 'clip', entrance: { presetId: `layer-${motion}-entrance`, params: {} } }]);
    return stateAt(stageOf({ clip: placement }, styles), outputSec, layerOn('clip'));
  }

  it('starts out of view, or invisible, the moment it comes in', async () => {
    expect((await entering('fade', 0)).opacity).toBe(0);
    expect((await entering('pop', 0)).opacity).toBe(0);
    expect((await entering('pop', 0)).transform.a).toBeCloseTo(0.9 - 0.7 * (0.4 / 0.9), 4);
    expect((await entering('slide', 0)).transform.e).toBeCloseTo(-1, 4);
    expect((await entering('push', 0)).transform.e).toBeCloseTo(-(0.03 + 0.27 * (0.3 / 0.9)), 4);
    expect((await entering('zoom-out', 0)).transform.a).toBeCloseTo(1.06 + 0.54 * (0.4 / 0.9), 4);
    expect((await entering('blur', 0)).blur).toBeCloseTo(0.006 + 0.054 * (0.4 / 0.9), 4);
    expect((await entering('wipe', 0)).clipInset.right).toBeCloseTo(1, 4);
    expect((await entering('spin', 0)).transform.a).toBeCloseTo(-0.3, 4);
  });

  it('slides in from just outside the frame, wherever its box rests', async () => {
    expect((await entering('slide', 0, INSET)).transform.e).toBeCloseTo(-(INSET_BOX.x + INSET_BOX.width), 4);
  });

  it('plays its keyframes on the layer\'s clock: a fade is half in halfway through', async () => {
    expect((await entering('fade', 0.2)).opacity).toBeCloseTo(0.5, 3);
  });

  it('comes in the same whatever it leaves with: an exit holds nothing over the entrance before it begins', async () => {
    const styles = stylesOf([{
      id: 'clip',
      entrance: { presetId: 'layer-slide-entrance', params: {} },
      exit: { presetId: 'layer-push-exit', params: {} },
    }]);

    const state = await stateAt(stageOf({ clip: FULL }, styles), 0, layerOn('clip'));

    expect(state.transform.e).toBeCloseTo(-1, 4);
  });

  it('has arrived once its duration has passed', async () => {
    expectAtRest(await entering('spin', 0.6));
  });
});

describe('a layer leaving', () => {
  async function leaving(motion: string, outputSec: number, params: Record<string, ElementControlValue> = {}): Promise<FootageLayerFrameState> {
    const styles = stylesOf([{ id: 'clip', exit: { presetId: `layer-${motion}-exit`, params } }]);
    return stateAt(stageOf({ clip: FULL }, styles), outputSec, layerOn('clip'));
  }

  it('rests until its exit begins, and is gone by the time the layer ends', async () => {
    expectAtRest(await leaving('fade', 3.59));
    expect((await leaving('fade', 3.9999)).opacity).toBeCloseTo(0, 3);
  });

  it('leaves travelling the way it is told: right by the right, up by the top', async () => {
    // A tenth of a millisecond before the end, on the steepest stretch of the curve.
    expect((await leaving('slide', 3.9999)).transform.e).toBeCloseTo(1, 2);
    expect((await leaving('slide', 3.9999, { direction: '270deg' })).transform.f).toBeCloseTo(-1, 2);
    expect((await leaving('wipe', 3.9999)).clipInset.left).toBeCloseTo(1, 2);
  });
});

it('gives each end at most half of a layer too short for both, so they never overlap', async () => {
  const styles = stylesOf([{
    id: 'clip',
    entrance: { presetId: 'layer-fade-entrance', params: { duration: 0.4 } },
    exit: { presetId: 'layer-fade-exit', params: { duration: 0.4 } },
  }]);
  const stage = stageOf({ clip: FULL }, styles);
  const short = layerOn('clip', 0, 0.4);

  const [coming, going] = await resolved(stage, [{ outputSec: 0.1, layers: [short] }, { outputSec: 0.3, layers: [short] }]);

  expect(coming![0]!.opacity).toBeCloseTo(0.5, 3);
  expect(going![0]!.opacity).toBeCloseTo(0.5, 3);
});

describe('every field of every layer motion', () => {
  /** The part of the layer's life a preset moves, by the part its id ends in. */
  function scopeOf(presetId: string): ElementAnimationScope {
    if (presetId.endsWith('-exit')) return EXIT;
    return ENTRANCE;
  }
  // A camera's presets are judged on a shot's own video (`a shot's own video`) and on a layer (`a layer's camera`).
  const fields = catalog.forKind('layer')
    .filter((preset) => !preset.id.endsWith('-camera'))
    .flatMap((preset) => preset.controls.map((control) => [preset.id, control] as const));

  /** The two ends of what a field can hold. */
  function endsOf(control: ElementControl): readonly [ElementControlValue, ElementControlValue] {
    if (control.type === 'number') return [control.min ?? 0, control.max ?? 1];
    const options = control.options ?? [];
    return [options[0]!.value, options[options.length - 1]!.value];
  }

  it.each(fields.map(([id, control]) => [`${id} · ${control.label}`, id, control] as const))(
    'changes what is drawn when it moves: %s',
    async (_name, presetId, control) => {
      const scope = scopeOf(presetId);
      // An end is judged as it plays.
      const outputSec = scope === EXIT ? 3.95 : 0.05;
      const at = async (value: ElementControlValue) => {
        const animation = { presetId, params: { [control.id]: value } };
        const styles = stylesOf([{ id: 'clip', [scope]: animation }]);
        return JSON.stringify(await stateAt(stageOf({ clip: INSET }, styles), outputSec, layerOn('clip')));
      };
      const [low, high] = endsOf(control);

      expect(await at(low)).not.toBe(await at(high));
    },
  );
});

describe('CSS written by hand', () => {
  it('turns a transform about any origin into the same transform about the box\'s centre', async () => {
    const styles = stylesOf([{ id: 'clip', css: 'transform: rotate(90deg); transform-origin: 0 0;' }]);
    const [width, height] = [INSET_BOX.width * FRAME.width, INSET_BOX.height * FRAME.height];

    const state = await stateAt(stageOf({ clip: INSET }, styles), 1, layerOn('clip'));

    expect(state.transform.a).toBeCloseTo(0, 6);
    expect(state.transform.b).toBeCloseTo(1, 6);
    expect(state.transform.c).toBeCloseTo(-1, 6);
    expect(state.transform.d).toBeCloseTo(0, 6);
    expect(state.transform.e * FRAME.width).toBeCloseTo(-width / 2 - height / 2, 3);
    expect(state.transform.f * FRAME.height).toBeCloseTo(width / 2 - height / 2, 3);
  });

  it('composes `translate`, `rotate` and `scale` with `transform`', async () => {
    const styles = stylesOf([{ id: 'clip', css: 'translate: 10% 0; scale: 2; transform: translateX(50px);' }]);

    const state = await stateAt(stageOf({ clip: INSET }, styles), 1, layerOn('clip'));

    expect(state.transform.a).toBeCloseTo(2, 6);
    expect(state.transform.e * FRAME.width).toBeCloseTo(0.1 * INSET_BOX.width * FRAME.width + 2 * 50, 3);
  });

  it('places the box where `left`, `top`, `width` and `height` say, over where its layout put it', async () => {
    const styles = stylesOf([{ id: 'clip', css: 'left: 100px; top: 10cqh; width: 50cqw; height: 300px; border-radius: 20px;' }]);

    const state = await stateAt(stageOf({ clip: INSET }, styles), 1, layerOn('clip'));

    expectRect(state.assetRect, { x: 0.1, y: 0.1, width: 0.5, height: 300 / FRAME.height });
    expect(state.cornerRadius).toBeCloseTo(20 / FRAME.width, 4);
  });

  it('places the box and the video where its declarations say, after the layout\'s', async () => {

    const styles = stylesOf([{
      id: 'clip',
      css: '--layer-box-left: 10cqw; --layer-box-top: 0px; --layer-box-width: 50cqw; --layer-box-height: 50cqh; '
        + '--video-left: 0px; --video-top: 50cqh; --video-width: 100cqw; --video-height: 50cqh; object-fit: contain;',
    }]);

    const state = await stateAt(stageOf({ clip: FULL }, styles), 1, layerOn('clip'));

    expectRect(state.assetRect, { x: 0.1, y: 0, width: 0.5, height: 0.5 });
    expectRect(state.videoRect, { x: 0, y: 0.5, width: 1, height: 0.5 });
    expect(state.fit).toBe('contain');
  });

  it('reads a clip and a blur off whatever lengths they were written in', async () => {
    const styles = stylesOf([{ id: 'clip', css: 'clip-path: inset(10% 20px calc(25% + 10px) 0); filter: blur(40px) brightness(2);' }]);

    const state = await stateAt(stageOf({ clip: FULL }, styles), 1, layerOn('clip'));

    expect(state.clipInset.top).toBeCloseTo(0.1, 4);
    expect(state.clipInset.right).toBeCloseTo(20 / FRAME.width, 4);
    expect(state.clipInset.bottom).toBeCloseTo(0.25 + 10 / FRAME.height, 4);
    expect(state.clipInset.left).toBe(0);
    expect(state.blur).toBeCloseTo(40 / Math.min(FRAME.width, FRAME.height), 4);
  });

  it('plays a layer\'s own keyframes on its own clock, and never another layer\'s of the same name', async () => {
    const own = (opacity: number) => `animation: glow 1s var(--on-layer-starts) both; @keyframes glow { from { opacity: ${opacity}; } to { opacity: ${opacity}; } }`;
    const styles = stylesOf([{ id: 'dim', css: own(0.2) }, { id: 'bright', css: own(0.8) }]);

    const [[dim, bright] = []] = await resolved(stageOf({ dim: INSET, bright: INSET }, styles), [{ outputSec: 0.5, layers: [layerOn('dim'), layerOn('bright')] }]);

    expect(dim!.opacity).toBeCloseTo(0.2, 4);
    expect(bright!.opacity).toBeCloseTo(0.8, 4);
  });
});

/**
 * Where each layout puts the box and the video, on the frames people
 * actually export: vertical and horizontal. Rects are normalized per
 * axis, so a length measured on the shorter side reads differently on
 * each axis of a frame that is not square.
 */
describe('a box the video floats in', () => {
  // `INSET` is a 400 px square on the 1000 × 2000 frame, centred, corners 4cqmin; with the video floating in it,
  // the box takes the video's shape, the frame's own: 400 × 800 px.
  const VIDEO_FLOATS: ShotLayerPlacement = { ...INSET, subject: 'video', aspectRatio: null } as ShotLayerPlacement;
  const FLOATING = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
  const WHOLE = { x: 0, y: 0, width: 1, height: 1 };

  async function floatingAt(css: string, outputSec: number, placement: ShotLayerPlacement = VIDEO_FLOATS): Promise<FootageLayerFrameState> {
    const styles = css.length > 0 ? ElementStyles.empty().withCss('clip', 'layer', css) : ElementStyles.empty();
    return stateAt(stageOf({ clip: placement }, styles), outputSec, layerOn('clip'));
  }

  it('draws the layer over the whole frame, square, and the video over it in the box, in the frame\'s shape, its corners rounded', async () => {
    const state = await floatingAt('', 1);

    expectRect(state.assetRect, WHOLE);
    expect(state.cornerRadius).toBe(0);
    expect(state.videoAbove).toBe(true);
    expectRect(state.videoRect, FLOATING);
    expect(state.videoCornerRadius).toBeCloseTo(0.04, 4);
  });

  it('keeps the layer floating over the video, as before, where the layer floats', async () => {
    const state = await floatingAt('', 1, INSET);

    expect(state.videoAbove).toBe(false);
    expect(state.videoRect).toBeNull();
    expectRect(state.assetRect, INSET_BOX);
  });

  it('shrinks the video from the whole frame into its box as the layer comes in, and grows it back as it leaves', async () => {
    const css = '--layer-inset-entrance: 1; --layer-inset-exit: 1;';
    const start = await floatingAt(css, 0);
    const halfway = await floatingAt(css, 0.25);
    const arrived = await floatingAt(css, 0.5);
    const leaving = await floatingAt(css, 3.75);

    expectRect(start.videoRect, WHOLE);
    expect(start.videoCornerRadius).toBe(0);
    expect(halfway.videoRect!.width).toBeGreaterThan(0.4);
    expect(halfway.videoRect!.width).toBeLessThan(1);
    expectRect(arrived.videoRect, FLOATING);
    expect(leaving.videoRect!.width).toBeGreaterThan(0.4);
  });

  it('keeps the video in its box from the start on a cut, which is what a box does unless told', async () => {
    expectRect((await floatingAt('', 0)).videoRect, FLOATING);
  });

  it('shrinks the layer itself from the whole frame where the layer floats', async () => {
    const start = await floatingAt('--layer-inset-entrance: 1;', 0, INSET);
    const arrived = await floatingAt('--layer-inset-entrance: 1;', 0.5, INSET);

    expectRect(start.assetRect, WHOLE);
    expect(start.cornerRadius).toBe(0);
    expectRect(arrived.assetRect, INSET_BOX);
  });
});

describe('a split coming and going', () => {
  // `SPLIT` puts the layer in the bottom 40% of the frame, with no padding; the transition takes half a second.
  const PART = { x: 0, y: 0.6, width: 1, height: 0.4 };
  const VIDEO_PART = { x: 0, y: 0, width: 1, height: 0.6 };

  /** The layer, split by `SPLIT` with this transition CSS, on the stage for 0 to 4 s, at `outputSec`. */
  async function splitAt(css: string, outputSec: number, placement: ShotLayerPlacement = SPLIT): Promise<FootageLayerFrameState> {
    const styles = css.length > 0 ? ElementStyles.empty().withCss('clip', 'layer', css) : ElementStyles.empty();
    return stateAt(stageOf({ clip: placement }, styles), outputSec, layerOn('clip'));
  }

  it('slides the layer in with the line by default, the video keeping the rest', async () => {
    const start = await splitAt('', 0);
    const halfway = await splitAt('', 0.25);
    const arrived = await splitAt('', 0.5);

    expect(start.videoRect).toBeNull();
    expect(start.transform.f).toBeCloseTo(0.4, 3);
    expectRect(halfway.videoRect, { x: 0, y: 0, width: 1, height: 0.8 });
    expect(halfway.transform.f).toBeCloseTo(0.2, 3);
    expectRect(halfway.assetRect, PART);
    expectRect(arrived.videoRect, VIDEO_PART);
    expectAtRest(arrived);
  });

  it('splits the frame at once on a cut', async () => {
    const start = await splitAt('--layer-split-entrance: 0;', 0);

    expectRect(start.videoRect, VIDEO_PART);
    expectAtRest(start);
  });

  it('uncovers the layer where it rests on a reveal, from the line\'s side', async () => {
    const halfway = await splitAt('--layer-split-entrance: 2;', 0.25);

    expectRect(halfway.videoRect, { x: 0, y: 0, width: 1, height: 0.8 });
    expect(halfway.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    // Its part is the frame's bottom 40%; the half of it nearest the line is still covered.
    expectRect(halfway.clipRect, { x: 0, y: 0.8, width: 1, height: 0.2 });
  });

  it('takes as long as it is told, eased in and out', async () => {
    const early = await splitAt('--layer-split-entrance-duration: 1s;', 0.25);
    const halfway = await splitAt('--layer-split-entrance-duration: 1s;', 0.5);

    expect(early.transform.f).toBeGreaterThan(0.3);
    expect(halfway.transform.f).toBeCloseTo(0.2, 3);
  });

  it('joins the frame back as the layer leaves, by its own transition', async () => {
    const resting = await splitAt('--layer-split-exit: 2;', 3.4);
    const halfway = await splitAt('--layer-split-exit: 2;', 3.75);

    expectRect(resting.videoRect, VIDEO_PART);
    expectAtRest(resting);
    expectRect(halfway.videoRect, { x: 0, y: 0, width: 1, height: 0.8 });
    expectRect(halfway.clipRect, { x: 0, y: 0.8, width: 1, height: 0.2 });
  });

  it('slides a top part in from the top', async () => {
    const halfway = await splitAt('', 0.25, { ...SPLIT, assetSide: 'start' } as ShotLayerPlacement);

    expectRect(halfway.videoRect, { x: 0, y: 0.2, width: 1, height: 0.8 });
    expect(halfway.transform.f).toBeCloseTo(-0.2, 3);
  });

  it('never moves a layer that is not split', async () => {
    expectAtRest(await splitAt('--layer-split-entrance: 2;', 0.25, FULL));
    expectAtRest(await splitAt('', 0, INSET));
  });
});

describe('a layer\'s layout', () => {
  function split(overrides: Partial<SplitShotLayerPlacement> = {}): SplitShotLayerPlacement {
    return { kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover', ...overrides };
  }

  function inset(overrides: Partial<InsetShotLayerPlacement> = {}): InsetShotLayerPlacement {
    return {
      kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.5, aspectRatio: null, padding: 0, cornerRadius: 0.05, fit: 'cover',
      ...overrides,
    };
  }

  async function laidOut(
    placement: ShotLayerPlacement,
    frame: { width: number; height: number } | null,
    assetAspectRatio: number | null,
  ): Promise<FootageLayerFrameState> {
    return stateAt(stageOf({ clip: placement }, ElementStyles.empty(), frame, assetAspectRatio), 1, layerOn('clip'));
  }

  it('covers the whole frame with a full layer and leaves the video as it is', async () => {
    const state = await laidOut({ kind: 'full', fit: 'contain' }, VERTICAL, 1);

    expectRect(state.assetRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(state.videoRect).toBeNull();
    expect(state.fit).toBe('contain');
    expect(state.cornerRadius).toBe(0);
  });

  it('cuts a vertical frame into top and bottom, the video re-framed into the other part', async () => {
    const state = await laidOut(split({ assetRatio: 0.4, cornerRadius: 0.1, fit: 'contain' }), VERTICAL, null);

    expectRect(state.assetRect, { x: 0, y: 0, width: 1, height: 0.4 });
    expectRect(state.videoRect, { x: 0, y: 0.4, width: 1, height: 0.6 });
    expect(state.fit).toBe('contain');
    expect(state.cornerRadius).toBeCloseTo(0.1, 4);
  });

  it('cuts a horizontal frame into left and right', async () => {
    const state = await laidOut(split({ assetSide: 'end', assetRatio: 0.4 }), HORIZONTAL, null);

    expectRect(state.assetRect, { x: 0.6, y: 0, width: 0.4, height: 1 });
    expectRect(state.videoRect, { x: 0, y: 0, width: 0.6, height: 1 });
  });

  it('cuts a square frame into top and bottom', async () => {
    const state = await laidOut(split(), { width: 1000, height: 1000 }, null);

    expectRect(state.videoRect, { x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it('keeps the box a margin measured on the frame\'s shorter side inside its part', async () => {
    // 0.1 of 1080 px is 108 px: 0.1 of the width, 0.05625 of the height.
    const state = await laidOut(split({ padding: 0.1 }), VERTICAL, null);

    expectRect(state.assetRect, { x: 0.1, y: 0.05625, width: 0.8, height: 0.5 - 2 * 0.05625 });
    expectRect(state.videoRect, { x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it('sizes a box from its width and the file\'s own shape, centred where asked', async () => {
    const state = await laidOut(inset(), VERTICAL, 1);

    // A square box half the width wide: 540 px, which is 0.28125 of the height.
    expectRect(state.assetRect, { x: 0.25, y: 0.5 - 0.28125 / 2, width: 0.5, height: 0.28125 });
    expect(state.videoRect).toBeNull();
    expect(state.cornerRadius).toBeCloseTo(0.05, 4);
  });

  it('takes a set shape over the file\'s own', async () => {
    const state = await laidOut(inset({ aspectRatio: 2 }), HORIZONTAL, 0.5);

    // 960 px wide, 480 px tall.
    expectRect(state.assetRect, { x: 0.25, y: 0.5 - (480 / 1080) / 2, width: 0.5, height: 480 / 1080 });
  });

  it('takes the frame\'s shape when the file\'s own is not known', async () => {
    const state = await laidOut(inset(), VERTICAL, null);

    expectRect(state.assetRect, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('pushes a box crossing the padding back inside the frame', async () => {
    // 0.04 of 1080 px is 43.2 px: 0.04 of the width, 0.0225 of the height.
    const state = await laidOut(inset({ centerX: 1, centerY: 0, padding: 0.04 }), VERTICAL, 1);

    expectRect(state.assetRect, { x: 1 - 0.04 - 0.5, y: 0.0225, width: 0.5, height: 0.28125 });
  });

  it('shrinks a box too big for the frame, keeping its shape', async () => {
    const { assetRect: rect } = await laidOut(inset({ width: 1, aspectRatio: 0.5, padding: 0.1 }), HORIZONTAL, null);

    expect(rect.y).toBeCloseTo(0.1, 3);
    expect(rect.height).toBeCloseTo(0.8, 3);
    expect((rect.width * HORIZONTAL.width) / (rect.height * HORIZONTAL.height)).toBeCloseTo(0.5, 3);
    expect(rect.x + rect.width / 2).toBeCloseTo(0.5, 3);
  });

  it('takes a frame of unknown size as square', async () => {
    const state = await laidOut(inset(), null, null);

    expectRect(state.assetRect, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('lays out a layer whose fields name no layout on the whole frame, covering it', async () => {
    const state = await stateAt(stages.build([{ layerId: 'clip', assetAspectRatio: 1 }], ElementStyles.empty(), FRAME, ORIGINAL), 1, layerOn('clip'));

    expectRect(state.assetRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(state.videoRect).toBeNull();
    expect(state.fit).toBe('cover');
  });

  it('gives a box whose fields hold only its layout the settings a fresh one starts with', async () => {
    const fresh = ElementStyles.empty().withCss('clip', 'layer', '--layer-layout: 2;');
    const pushedLeft = ElementStyles.empty().withCss('clip', 'layer', '--layer-layout: 2; --layer-center-x: 0;');
    const stageWith = (styles: ElementStyles) => stages.build([{ layerId: 'clip', assetAspectRatio: 1 }], styles, FRAME, ORIGINAL);

    const state = await stateAt(stageWith(fresh), 1, layerOn('clip'));
    const pushed = await stateAt(stageWith(pushedLeft), 1, layerOn('clip'));

    // 0.4 of the width, square, centred; corners and padding 0.04 of the shorter side.
    expectRect(state.assetRect, { x: 0.3, y: 0.4, width: 0.4, height: 0.2 });
    expect(state.cornerRadius).toBeCloseTo(0.04, 4);
    expect(pushed.assetRect.x).toBeCloseTo(0.04, 4);
  });
});

it('resolves a frame of three moving layers in well under a frame\'s time', async () => {

  const motions = ['slide', 'spin', 'wipe'];
  const styles = stylesOf(motions.map((motion) => ({
    id: motion,
    entrance: { presetId: `layer-${motion}-entrance`, params: {} },
    exit: { presetId: `layer-${motion}-exit`, params: {} },
  })));
  const stage = stageOf(Object.fromEntries(motions.map((motion) => [motion, INSET])), styles);
  const layers = motions.map((motion) => layerOn(motion));
  const frames = 300;

  const elapsedMs = await page.evaluate(({ stage, layers, frames }) => {
    const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => unknown> }).fixture;
    const factory = new fixture.CssFootageLayerResolverFactory!(
      new fixture.ComputedFootageLayerStateReader!(),
      new fixture.FootageStageBaselineCss!(),
      new fixture.CssFootageLayerClockFactory!(new fixture.CssFootageClockUseInspector!()),
    ) as { open(...args: unknown[]): PageResolver };
    const footage = layers.map((layer) => ({ ...layer, source: { kind: 'image', blob: new Blob() }, sourceStartSec: 0, sourcePassSec: 0 }));
    const resolver = factory.open(footage, stage);
    resolver.resolveAt(0);
    const started = performance.now();
    for (let frame = 0; frame < frames; frame++) resolver.resolveAt(((frame + 0.5) / frames) * 4);
    const elapsed = performance.now() - started;
    resolver.dispose();
    return elapsed;
  }, { stage, layers, frames });

  console.log(`[shots] resolving ${layers.length} layers: ${(elapsedMs / frames).toFixed(3)} ms a frame over ${frames} frames`);
  expect(elapsedMs / frames).toBeLessThan(8);
});

describe('the video in an output frame of another shape', () => {
  const videoPictures = new VideoPictureFootageBuilder();
  const unshot = (frame: OutputFrame) => ({ frame, outputDurationSec: 10, shots: [], styledVideo: false });
  const vertical = OutputFrame.original().withFormat('9:16');

  /** The state each box showing the video rests in, by id, for `frame` over a 10 s output. */
  async function videoBoxes(frame: OutputFrame): Promise<Record<string, FootageLayerFrameState>> {
    const built = videoPictures.build(unshot(frame));
    const stage = stages.build(built.map((layer) => layer.staged), ElementStyles.empty(), VERTICAL, frame);
    const asked = built.map(({ footage }) => ({ ...layerOn(footage.id, 0, 10), showsVideo: true }));
    const [states = []] = await resolved(stage, [{ outputSec: 1, layers: asked }]);
    return Object.fromEntries(asked.map((layer, index) => [layer.id, states[index]!]));
  }

  it('fills the frame with the video, cropped where its position says, at rest', async () => {
    const boxes = await videoBoxes(vertical.withPosition({ x: 0.25, y: 0.5 }));

    expect(Object.keys(boxes)).toEqual(['output-frame-video']);
    const video = boxes['output-frame-video']!;
    expectRect(video.assetRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(video.fit).toBe('cover');
    expect(video.position.x.share).toBeCloseTo(0.25, 6);
    expect(video.position.y.share).toBeCloseTo(0.5, 6);
    expect(video.videoRect).toBeNull();
    expectAtRest(video);
  });

  it('fits the whole video over a blurred copy of it that covers the frame', async () => {
    const boxes = await videoBoxes(vertical.withFit('fit'));

    expect(Object.keys(boxes)).toEqual(['output-frame-backdrop', 'output-frame-video']);
    expect(boxes['output-frame-video']!.fit).toBe('contain');
    expectAtRest(boxes['output-frame-video']!);
    const backdrop = boxes['output-frame-backdrop']!;
    expect(backdrop.fit).toBe('cover');
    expect(backdrop.blur).toBeGreaterThan(0);
    expect(backdrop.transform.a).toBeGreaterThan(1);
  });

  it('fits it over black where the background asked is black', async () => {
    const boxes = await videoBoxes(vertical.withFit('fit').withBackdrop('black'));

    expect(Object.keys(boxes)).toEqual(['output-frame-video']);
    expect(boxes['output-frame-video']!.fit).toBe('contain');
  });

  it('puts nothing on the stage for the video\'s own shape', () => {
    expect(videoPictures.build(unshot(OutputFrame.original()))).toEqual([]);
  });
});

describe('a shot\'s own video, zoomed', () => {
  const videoPictures = new VideoPictureFootageBuilder();
  const shots = [
    { shotId: 'a', outputStartSec: 0, outputEndSec: 4 },
    { shotId: 'b', outputStartSec: 4, outputEndSec: 10 },
  ];

  /** The state the second shot's video box is drawn in at `outputSec`, under `css` and moved by `camera`. */
  async function secondShotAt(
    outputSec: number,
    css?: string,
    camera?: ElementAnimation,
    frame: OutputFrame = OutputFrame.original(),
  ): Promise<FootageLayerFrameState> {
    const built = videoPictures.build({ frame, outputDurationSec: 10, shots, styledVideo: true });
    const styles = stylesOf([{
      id: 'shot-video-b',
      ...(camera && { camera }),
      ...(css !== undefined && { css }),
    }]);
    const stage = stages.build(built.map((layer) => layer.staged), styles, HORIZONTAL, frame);
    const asked = built.map(({ footage }) => ({
      id: footage.id,
      outputStartSec: footage.outputStartSec,
      outputEndSec: footage.outputEndSec,
      showsVideo: true,
    }));
    const [states = []] = await resolved(stage, [{ outputSec, layers: asked.filter((layer) => layer.id === 'shot-video-b') }]);
    return states[0]!;
  }

  it('draws one box of the video per shot, over each shot\'s stretch, and none while nothing is styled', () => {
    const built = videoPictures.build({ frame: OutputFrame.original(), outputDurationSec: 10, shots, styledVideo: true });

    expect(built.map(({ footage }) => [footage.id, footage.outputStartSec, footage.outputEndSec])).toEqual([
      ['shot-video-a', 0, 4],
      ['shot-video-b', 4, 10],
    ]);
    expect(videoPictures.build({ frame: OutputFrame.original(), outputDurationSec: 10, shots, styledVideo: false })).toEqual([]);
  });

  it('moves a shot\'s camera from its start framing to its end one over the move\'s duration, then holds', async () => {
    const zoomIn = { presetId: 'layer-zoom-in-camera', params: { zoom: 2, duration: 2 } };
    const start = await secondShotAt(4, '--layer-picture-end-x: 0;', zoomIn);
    const halfway = await secondShotAt(5, '--layer-picture-end-x: 0;', zoomIn);
    const held = await secondShotAt(9, '--layer-picture-end-x: 0;', zoomIn);

    expectRect(start.assetRect, { x: 0, y: 0, width: 1, height: 1 });
    // Eased in and out, half way through the time is half way there.
    expect(halfway.assetRect.width).toBeCloseTo(1.5, 2);
    expectRect(held.assetRect, { x: 0, y: -0.5, width: 2, height: 2 });
  });

  it('eases a camera move over the whole shot when it names no duration', async () => {
    const pushIn = { presetId: 'layer-slow-push-in-camera', params: { zoom: 2 } };
    const quarter = await secondShotAt(5.5, undefined, pushIn);
    const end = await secondShotAt(9.999, undefined, pushIn);

    // A quarter of the way through, smoothstep has gone 0.15625 of the way.
    expect(quarter.assetRect.width).toBeCloseTo(1.156, 2);
    expect(end.assetRect.width).toBeCloseTo(2, 2);
  });

  it('moves a long camera move on every frame, never in steps', async () => {
    const pushIn = { presetId: 'layer-slow-push-in-camera', params: { zoom: 2 } };
    // Four frames in a row, at 30 fps, early in a six-second push.
    const widths = await Promise.all([0, 1, 2, 3].map(async (frame) => (await secondShotAt(5 + frame / 30, undefined, pushIn)).assetRect.width));

    for (let frame = 1; frame < widths.length; frame++) expect(widths[frame]!).toBeGreaterThan(widths[frame - 1]!);
  });

  it('holds a punch in for the whole shot', async () => {
    const held = await secondShotAt(9, undefined, { presetId: 'layer-punch-in-camera', params: { zoom: 1.5 } });

    expect(held.assetRect.width).toBeCloseTo(1.5, 3);
  });

  it('pans across the picture, and looks where the shot says on the axis it does not pan', async () => {
    const pan = { presetId: 'layer-pan-right-camera', params: { zoom: 2 } };
    const start = await secondShotAt(4, '--layer-picture-y: 0;', pan);
    const end = await secondShotAt(9.999, '--layer-picture-y: 0;', pan);

    // Twice the frame, it travels from the left edge to the right one.
    expectRect(start.assetRect, { x: 0, y: 0, width: 2, height: 2 });
    expect(end.assetRect.x).toBeCloseTo(-1, 2);
  });

  it('changes what is drawn with every field of every camera preset', async () => {
    for (const preset of catalog.forKind('layer').filter((candidate) => candidate.id.endsWith('-camera'))) {
      for (const control of preset.controls) {
        const ends = control.type === 'number' ? [control.min ?? 0, control.max ?? 1] : [control.options![0]!.value, control.options!.at(-1)!.value];
        // Half a second in, where every camera is under way.
        const at = async (value: ElementControlValue) => JSON.stringify(
          await secondShotAt(4.5, undefined, { presetId: preset.id, params: { [control.id]: value } }),
        );
        expect(await at(ends[0]!), `${preset.id} · ${control.label}`).not.toBe(await at(ends[1]!));
      }
    }
  });

  it('crops a shot\'s video closer, keeping the part its framing names', async () => {
    const framed = await secondShotAt(5, '--layer-picture-x: 0; --layer-picture-y: 1;', { presetId: 'layer-punch-in-camera', params: { zoom: 2 } });

    // Twice the frame, its left and bottom edges on the frame's: the left half and the bottom half kept.
    expectRect(framed.assetRect, { x: 0, y: -1, width: 2, height: 2 });
    expect(framed.position.x.share).toBeCloseTo(0, 6);
    expect(framed.position.y.share).toBeCloseTo(1, 6);
    expectAtRest(framed);
  });

  it('keeps a fitted video in the middle of its box while the camera closes in off centre', async () => {
    const fitted = OutputFrame.original().withFormat('1:1').withFit('fit');
    const aimed = await secondShotAt(5, '--layer-picture-x: 0.2; --layer-picture-y: 0.3;', { presetId: 'layer-punch-in-camera', params: { zoom: 2 } }, fitted);

    // The box moves to keep the aimed part in view; the video stays centred inside it, its bars around it.
    expectRect(aimed.assetRect, { x: -0.2, y: -0.3, width: 2, height: 2 });
    expect(aimed.fit).toBe('contain');
    expect(aimed.position.x.share).toBeCloseTo(0.5, 6);
    expect(aimed.position.y.share).toBeCloseTo(0.5, 6);
  });

});

describe('a layer\'s camera', () => {
  const cover = (placement: ShotLayerPlacement) => ({ ...placement, fit: 'cover' } as ShotLayerPlacement);
  async function filmedAt(camera: ElementAnimation, placement: ShotLayerPlacement, outputSec: number): Promise<FootageLayerFrameState> {
    return stateAt(stageOf({ clip: cover(placement) }, stylesOf([{ id: 'clip', camera }])), outputSec, layerOn('clip'));
  }

  it('keeps the part of the file its layout crops to while the camera places nothing of its own, and the camera\'s own where it does', async () => {
    const punchIn = { presetId: 'layer-punch-in-camera', params: { zoom: 2 } };
    const croppedLeft: ShotLayerPlacement = { kind: 'full', fit: 'cover', position: { x: 0, y: 0.5 } };
    const followed = await filmedAt(punchIn, croppedLeft, 1);
    const placed = await stateAt(
      stageOf({ clip: croppedLeft }, stylesOf([{ id: 'clip', camera: punchIn, css: '--layer-picture-x: 1;' }])),
      1,
      layerOn('clip'),
    );

    // Twice the frame across, its left edge on the frame's: the left of the file kept.
    expect(followed.assetRect.x).toBeCloseTo(0, 3);
    // Its own position keeps the right edge instead.
    expect(placed.assetRect.x + placed.assetRect.width).toBeCloseTo(1, 3);
  });

  it('closes in on the picture inside a split\'s part, the part and the line staying where they are', async () => {
    const pushIn = { presetId: 'layer-slow-push-in-camera', params: { zoom: 2 } };
    // Late, before the split's exit starts joining the frame back.
    const start = await filmedAt(pushIn, SPLIT, 1);
    const end = await filmedAt(pushIn, SPLIT, 3.4);

    expectRect(start.clipRect, { x: 0, y: 0.6, width: 1, height: 0.4 });
    expectRect(end.clipRect, { x: 0, y: 0.6, width: 1, height: 0.4 });
    expectRect(end.videoRect, { x: 0, y: 0, width: 1, height: 0.6 });
    expect(end.assetRect.width).toBeGreaterThan(1.7);
    expect(end.clipRadius).toBeCloseTo(start.clipRadius, 4);
  });

  it('pans across the picture inside a floating box, the box staying where it is', async () => {
    const pan = { presetId: 'layer-pan-right-camera', params: { zoom: 2 } };
    const start = await filmedAt(pan, INSET, 1);
    const end = await filmedAt(pan, INSET, 3.999);

    expectRect(start.clipRect, INSET_BOX);
    expectRect(end.clipRect, INSET_BOX);
    expect(end.assetRect.x).toBeLessThan(start.assetRect.x);
  });

  it('crashes in on the picture inside a floating box, the box staying where it is', async () => {
    const crash = { presetId: 'layer-crash-zoom-camera', params: {} };
    const end = await filmedAt(crash, INSET, 1);

    expectRect(end.clipRect, INSET_BOX);
    expect(end.assetRect.width).toBeCloseTo(INSET_BOX.width * 1.9, 2);
  });

  it('shakes the picture inside a box, not the box', async () => {
    const shake = { presetId: 'layer-shake-camera', params: { intensity: 1 } };
    const one = await filmedAt(shake, INSET, 1.12);
    const other = await filmedAt(shake, INSET, 1.24);

    expectRect(one.clipRect, INSET_BOX);
    expectRect(other.clipRect, INSET_BOX);
    expect(one.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    expect(Math.abs(one.assetRect.x - other.assetRect.x)).toBeGreaterThan(0.001);
  });

  it('bounces in on the picture and back out, over the box\'s own place', async () => {
    const bounce = { presetId: 'layer-bounce-camera', params: { intensity: 1 } };
    const rest = await filmedAt(bounce, FULL, 0);
    const close = await filmedAt(bounce, FULL, 2);

    expectRect(rest.assetRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(close.assetRect.width).toBeCloseTo(1.6, 2);
    expect(close.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });
});

describe('a transition between shots', () => {
  const CUT_SEC = 1.25;
  const transitionOn = (kind: ShotTransitionKind, durationSec = 0.5, clippedSec = 0): FootageStyle =>
    stages.build([], ElementStyles.empty(), FRAME, ORIGINAL, [{ layerId: `shot-transition:${kind}`, kind, durationSec, clippedSec }]);
  const boxOf = (kind: ShotTransitionKind, durationSec = 0.5) =>
    layerOn(`shot-transition:${kind}`, CUT_SEC - durationSec / 2, CUT_SEC + durationSec / 2);
  const statesOf = async (kind: ShotTransitionKind, moments: ReadonlyArray<number>) => {
    const box = boxOf(kind);
    return (await resolved(transitionOn(kind), moments.map((outputSec) => ({ outputSec, layers: [box] })))).map(([state]) => state!);
  };
  // Across the frame, where what shows of a wiped shot ends, and of the next one starts: the box, moved, less its cut.
  const leadingEdge = (state: FootageLayerFrameState) => 1 + state.transform.e - state.clipInset.right;
  const trailingEdge = (state: FootageLayerFrameState) => state.transform.e + state.clipInset.left;

  it('covers the whole frame, uncut, and leaves the video where it is', async () => {
    const [state] = await statesOf('flash', [CUT_SEC]);

    expect(state!.assetRect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(state!.videoRect).toBeNull();
    expectRect(state!.clipRect, { x: 0, y: 0, width: 1, height: 1 });
    expect(state!.clipRadius).toBe(0);
  });

  it('flashes to white on the cut, over white, at rest at either end', async () => {
    const [start, cut, end] = await statesOf('flash', [1, CUT_SEC, 1.4999]);

    expect(cut!.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(start!.opacity).toBeCloseTo(1, 2);
    expect(cut!.opacity).toBeCloseTo(0, 2);
    expect(end!.opacity).toBeCloseTo(1, 1);
  });

  it('brings the next shot back out of the flash overexposed, and settles it slower than it burnt out', async () => {
    const [gathering, recovering] = await statesOf('flash', [CUT_SEC - 0.05, CUT_SEC + 0.05]);

    expect(recovering!.opacity).toBeGreaterThan(0.5);
    expect(recovering!.brightness).toBeGreaterThan(1.5);
    expect(recovering!.brightness).toBeGreaterThan(gathering!.brightness);
  });

  it('dips to white by burning the picture out before fading it, and holds the white around the cut', async () => {
    const [burning, held, cut] = await statesOf('fade-white', [CUT_SEC - 0.11, CUT_SEC - 0.02, CUT_SEC]);

    expect(burning!.opacity).toBeCloseTo(1, 1);
    expect(burning!.brightness).toBeGreaterThan(1.5);
    expect(cut!.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(held!.opacity).toBeCloseTo(0, 2);
    expect(cut!.opacity).toBeCloseTo(0, 2);
  });

  it('passes a panel across that covers the frame on the cut, pushing the shot ahead of it and the next one in after it', async () => {
    const [into, cut, outOf] = await statesOf('wipe', [CUT_SEC - 0.05, CUT_SEC - 0.0001, CUT_SEC + 0.05]);

    expect(into!.transform.e).toBeLessThan(0);
    expect(leadingEdge(into!)).toBeGreaterThan(0);
    expect(leadingEdge(into!)).toBeLessThan(1);
    expect(leadingEdge(cut!)).toBeCloseTo(0, 2);
    expect(outOf!.transform.e).toBeGreaterThan(0);
    expect(trailingEdge(outOf!)).toBeGreaterThan(0);
    expect(trailingEdge(outOf!)).toBeLessThan(1);
  });

  it('never stops the wipe\'s panel on the cut: it crosses it as fast as it reached it', async () => {
    const [before, onTheCut, justAfter, after] = await statesOf('wipe', [CUT_SEC - 0.02, CUT_SEC - 0.0001, CUT_SEC + 0.0001, CUT_SEC + 0.02]);
    const travelledInto = leadingEdge(before!) - leadingEdge(onTheCut!);
    const travelledOutOf = trailingEdge(justAfter!) - trailingEdge(after!);

    expect(travelledInto).toBeGreaterThan(0.05);
    expect(travelledOutOf / travelledInto).toBeCloseTo(1, 0);
  });

  it('closes a circle on the centre of the frame on the cut and opens the next shot out of it', async () => {
    const [open, closing, cut, opening, reopened] = await statesOf('iris', [1, CUT_SEC - 0.1, CUT_SEC, CUT_SEC + 0.1, 1.4999]);
    const shorterSide = Math.min(FRAME.width, FRAME.height);
    const halfDiagonal = Math.hypot(FRAME.width, FRAME.height) / 2;

    for (const state of [closing!, opening!]) {
      const rect = state.clipRect!;
      const radiusPx = state.clipRadius * shorterSide;
      expect(radiusPx).toBeGreaterThan(0);
      expect(radiusPx).toBeLessThan(halfDiagonal);
      expect(rect.width * FRAME.width).toBeCloseTo(2 * radiusPx, 0);
      expect(rect.height * FRAME.height).toBeCloseTo(2 * radiusPx, 0);
      expect(rect.x + rect.width / 2).toBeCloseTo(0.5, 3);
      expect(rect.y + rect.height / 2).toBeCloseTo(0.5, 3);
    }
    expect(cut!.clipRadius).toBeCloseTo(0, 4);
    for (const whole of [open!, reopened!]) expect(whole.clipRadius * shorterSide).toBeGreaterThanOrEqual(halfDiagonal - 1);
  });

  it('spins one way into the cut and in from the other', async () => {
    const [into, outOf] = await statesOf('spin', [CUT_SEC - 0.01, CUT_SEC + 0.01]);

    expect(Math.atan2(into!.transform.b, into!.transform.a)).toBeLessThan(0);
    expect(Math.atan2(outOf!.transform.b, outOf!.transform.a)).toBeGreaterThan(0);
  });

  it('whips up the frame into the cut and in from below out of it', async () => {
    const [into, outOf] = await statesOf('whip-up', [CUT_SEC - 0.01, CUT_SEC + 0.01]);

    expect(into!.transform.f).toBeLessThan(0);
    expect(outOf!.transform.f).toBeGreaterThan(0);
    expect(into!.transform.e).toBeCloseTo(0, 6);
  });

  it('jolts the frame on the cut, and the glitch jumps it about, each settling before the end', async () => {
    const [shaken, settled] = await statesOf('shake', [CUT_SEC, 1.49]);
    const [glitched, calm] = await statesOf('glitch', [CUT_SEC, 1.49]);

    expect(shaken!.transform.e).not.toBeCloseTo(0, 3);
    expect(settled!.transform.e).toBeCloseTo(0, 6);
    expect(glitched!.transform.e).not.toBeCloseTo(0, 3);
    expectAtRest(calm!);
  });

  it('fades out over black on the cut, so what is laid over the picture fades with it', async () => {
    const [before, cut] = await statesOf('fade-black', [1.1, CUT_SEC]);

    expect(cut!.backgroundColor).toBeNull();
    expect(before!.opacity).toBeGreaterThan(0);
    expect(before!.opacity).toBeLessThan(1);
    expect(cut!.opacity).toBeCloseTo(0, 2);
    expect(cut!.brightness).toBe(1);
  });

  it('dips to black without stalling in it: a fifth of its length before the cut, the picture still shows', async () => {
    const [fading, held] = await statesOf('fade-black', [CUT_SEC - 0.1, CUT_SEC - 0.02]);

    expect(fading!.opacity).toBeGreaterThan(0.15);
    expect(held!.opacity).toBeCloseTo(0, 2);
  });

  it('blurs out on the cut by a share of the frame\'s shorter side, pushed in so the blur\'s soft edges fall off the frame', async () => {
    const [start, cut] = await statesOf('blur', [1, CUT_SEC]);

    expect(start!.blur).toBeCloseTo(0, 4);
    expect(cut!.blur).toBeCloseTo(0.05, 3);
    expect(cut!.transform.a).toBeGreaterThan(1 + 2 * cut!.blur);
  });

  it('whips away one way into the cut and in from the other way out of it, never uncovering the frame', async () => {
    const [start, into, outOf, end] = await statesOf('whip', [1, CUT_SEC - 0.01, CUT_SEC + 0.01, 1.4999]);

    expectAtRest(start!);
    expect(into!.transform.e).toBeLessThan(0);
    expect(outOf!.transform.e).toBeGreaterThan(0);
    for (const moving of [into!, outOf!]) {
      const halfWidth = moving.transform.a / 2;
      expect(0.5 + moving.transform.e - halfWidth).toBeLessThanOrEqual(0);
      expect(0.5 + moving.transform.e + halfWidth).toBeGreaterThanOrEqual(1);
      expect(moving.blur).toBeGreaterThan(0);
    }
    expect(end!.transform.a).toBeCloseTo(1, 2);
  });

  it('keeps its peak on the cut when the output\'s start cuts its first half short', async () => {
    const box = layerOn('shot-transition:flash', 0, 0.35);
    const cut = (await resolved(transitionOn('flash', 0.5, 0.1), [{ outputSec: 0.15, layers: [box] }]))[0]![0]!;

    expect(cut.opacity).toBeCloseTo(0, 2);
  });
});

describe('a shot\'s own video, following a person', () => {
  const videoPictures = new VideoPictureFootageBuilder();
  const follows = new ShotFollowStager(new ShotFollowCrop(catalog), new CameraPathPlanner(new HeadFraming()));
  const vertical = OutputFrame.original().withFormat('9:16');
  const PICTURE_SHAPE = 16 / 9;
  // A 9:16 frame filled with a 16:9 picture shows this share of its width.
  const CROP_WIDTH = (9 / 16) / PICTURE_SHAPE;

  /** Heads every quarter second over `fromSec`..`toSec` of the source, across the picture as `xAt` says, at a third of its height. */
  function followOf(fromSec: number, toSec: number, xAt: (sec: number) => number): ShotFollow {
    const heads = [];
    for (let sec = fromSec; sec <= toSec + 1e-9; sec += 0.25) heads.push({ sourceSec: sec, x: xAt(sec), y: 0.3 });
    return { pictureAspectRatio: PICTURE_SHAPE, heads };
  }

  /**
   * The state the second shot's video box (the source from 4 s to 10 s,
   * following `follow`) is drawn in at `outputSec`, with `cuts` taken out
   * of the source, its own `css` and `camera`.
   */
  async function followedAt(
    outputSec: number,
    follow: ShotFollow,
    options: { cuts?: ReadonlyArray<{ startSec: number; endSec: number }>; css?: string; camera?: ElementAnimation } = {},
  ): Promise<FootageLayerFrameState> {
    const timeMap = new RenderTimeMap(options.cuts ?? []);
    const styles = stylesOf([{ id: 'shot-video-b', ...(options.camera && { camera: options.camera }), ...(options.css !== undefined && { css: options.css }) }]);
    const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 4, follow }] }).withLayerStyles(styles);
    const videos = [
      { shotId: 'a', outputStartSec: 0, outputEndSec: timeMap.toOutputTime(4) },
      { shotId: 'b', outputStartSec: timeMap.toOutputTime(4), outputEndSec: timeMap.toOutputTime(10) },
    ];
    const built = videoPictures.build({ frame: vertical, outputDurationSec: timeMap.toOutputTime(10), shots: videos, styledVideo: true });
    const stage = stages.build(built.map((layer) => layer.staged), styles, VERTICAL, vertical, [], follows.stage(shots, videos, timeMap, VERTICAL, vertical));
    const box = built.find(({ footage }) => footage.id === 'shot-video-b')!.footage;
    const [states = []] = await resolved(stage, [{ outputSec, layers: [{ id: box.id, outputStartSec: box.outputStartSec, outputEndSec: box.outputEndSec, showsVideo: true }] }]);
    return states[0]!;
  }

  /** Which part of the picture across a box drawn in `state` shows in the frame: its middle and its width, as shares of the picture. */
  function cropOf(state: FootageLayerFrameState): { centre: number; width: number } {
    const box = { left: state.assetRect.x * VERTICAL.width, width: state.assetRect.width * VERTICAL.width, height: state.assetRect.height * VERTICAL.height };
    const pictureWidth = Math.max(box.width, box.height * PICTURE_SHAPE);
    const pictureLeft = box.left + state.position.x.share * (box.width - pictureWidth);
    return { centre: (VERTICAL.width / 2 - pictureLeft) / pictureWidth, width: VERTICAL.width / pictureWidth };
  }

  it('keeps the head of a person walking across the picture inside the crop, moving with them', async () => {
    const walk = (sec: number) => 0.2 + ((sec - 4) / 6) * 0.6;
    const follow = followOf(4, 10, walk);
    for (const outputSec of [4.5, 6, 7.5, 9.5]) {
      const crop = cropOf(await followedAt(outputSec, follow));
      expect(crop.width).toBeCloseTo(CROP_WIDTH, 3);
      expect(Math.abs(crop.centre - walk(outputSec)), `at ${outputSec} s`).toBeLessThan(crop.width / 2);
    }
    expect(cropOf(await followedAt(9.5, follow)).centre).toBeGreaterThan(cropOf(await followedAt(4.5, follow)).centre + CROP_WIDTH);
  });

  it('keeps pace with the picture across a cut inside the shot', async () => {
    const walk = (sec: number) => 0.1 + ((sec - 4) / 6) * 0.8;
    // The source from 6 s to 8 s is cut away: 7 s of the output shows 9 s of the source.
    const crop = cropOf(await followedAt(7, followOf(4, 10, walk), { cuts: [{ startSec: 6, endSec: 8 }] }));
    expect(Math.abs(crop.centre - walk(9))).toBeLessThan(crop.width / 2);
  });

  it('holds still on a person who stays inside one framing', async () => {
    const follow = followOf(4, 10, (sec) => 0.7 + 0.01 * Math.sin(sec * 4));
    const early = cropOf(await followedAt(5, follow));
    const late = cropOf(await followedAt(9, follow));
    expect(late.centre).toBeCloseTo(early.centre, 4);
    expect(Math.abs(early.centre - 0.7)).toBeLessThan(0.01);
  });

  it('writes a camera that holds still as one framing, which the export reads on every frame', () => {
    const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'b', startSec: 0, follow: followOf(0, 6, () => 0.7) }] });
    const staged = follows.stage(shots, [{ shotId: 'b', outputStartSec: 0, outputEndSec: 6 }], new RenderTimeMap([]), VERTICAL, vertical);
    expect(staged[0]!.framings).toHaveLength(1);
  });

  it('frames the person wherever the shot\'s own position looks', async () => {
    const crop = cropOf(await followedAt(6, followOf(4, 10, () => 0.75), { css: '--layer-picture-x: 0;' }));
    expect(Math.abs(crop.centre - 0.75)).toBeLessThan(0.01);
  });

  it('runs on without a jump across the cut between two shots that follow the same person', async () => {
    const walk = (sec: number) => 0.15 + (sec / 10) * 0.7;
    const follow = followOf(0, 10, walk);
    const timeMap = new RenderTimeMap([]);
    const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, follow }, { id: 'b', startSec: 4, follow }] });
    const videos = [{ shotId: 'a', outputStartSec: 0, outputEndSec: 4 }, { shotId: 'b', outputStartSec: 4, outputEndSec: 10 }];
    const built = videoPictures.build({ frame: vertical, outputDurationSec: 10, shots: videos, styledVideo: true });
    const stage = stages.build(built.map((layer) => layer.staged), shots.layerStyles, VERTICAL, vertical, [], follows.stage(shots, videos, timeMap, VERTICAL, vertical));
    const boxOf = (id: string) => {
      const { footage } = built.find((layer) => layer.footage.id === id)!;
      return { id: footage.id, outputStartSec: footage.outputStartSec, outputEndSec: footage.outputEndSec, showsVideo: true };
    };
    const endOfA = await stateAt(stage, 3.99, boxOf('shot-video-a'));
    const startOfB = await stateAt(stage, 4, boxOf('shot-video-b'));

    expect(Math.abs(cropOf(startOfB).centre - cropOf(endOfA).centre)).toBeLessThan(0.005);
  });

  it('follows the person instead of the camera move the shot was given', async () => {
    const pan = { presetId: 'layer-pan-right-camera', params: { zoom: 1 } };
    // Panning right on its own, the crop would end at the picture's right edge.
    const crop = cropOf(await followedAt(9.5, followOf(4, 10, () => 0.25), { camera: pan }));
    expect(Math.abs(crop.centre - 0.25)).toBeLessThan(0.01);
  });

  it('says what the camera shows on a frame as the export frames it, held as close as the shot\'s camera holds it', async () => {
    const walk = (sec: number) => 0.2 + ((sec - 4) / 6) * 0.6;
    const follow = followOf(4, 10, walk);
    for (const camera of [undefined, { presetId: 'layer-punch-in-camera', params: { zoom: 2 } }]) {
      const styles = stylesOf([{ id: 'shot-video-b', ...(camera && { camera }) }]);
      const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 4, follow }] }).withLayerStyles(styles);
      for (const sec of [4.5, 7.5]) {
        const exported = cropOf(await followedAt(sec, follow, { ...(camera && { camera }) }));
        const view = follows.viewAt(shots, 'b', { startSec: 4, endSec: 10 }, sec, VERTICAL, vertical)!;
        expect(view.maxX - view.minX, `at ${sec} s`).toBeCloseTo(exported.width, 3);
        expect((view.minX + view.maxX) / 2, `at ${sec} s`).toBeCloseTo(exported.centre, 3);
        expect(view.maxY - view.minY).toBeCloseTo(camera ? 0.5 : 1, 3);
      }
    }
  });

  it('follows inside a closer crop, held as close as the shot\'s camera holds it', async () => {
    const walk = (sec: number) => 0.3 + ((sec - 4) / 6) * 0.4;
    const state = await followedAt(8, followOf(4, 10, walk), { camera: { presetId: 'layer-punch-in-camera', params: { zoom: 2 } } });
    const crop = cropOf(state);
    expect(crop.width).toBeCloseTo(CROP_WIDTH / 2, 3);
    expect(Math.abs(crop.centre - walk(8))).toBeLessThan(crop.width / 2);
  });
});
