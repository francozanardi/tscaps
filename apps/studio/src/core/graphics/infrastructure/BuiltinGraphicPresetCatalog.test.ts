import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';

/**
 * Every preset shipped plays: opened in the sandbox at the size of its
 * box, it draws a picture with something in it at every moment asked,
 * and its code throws nothing. Played in Chromium, which is what draws
 * them for the user.
 */

const STUDIO_SRC = resolve(__dirname, '../../..');
const FIXTURE_ID = 'graphic-presets-fixture';
const ORIGIN = 'http://editor.test';
const MOMENTS = [0.1, 0.6, 1.5, 2.9];

/** What one preset gave: its id, the share of each picture that is not transparent, and what it logged. */
interface Played {
  readonly id: string;
  readonly drawnShares: number[];
  readonly errors: string[];
  /** The ids of the moments its code declared, and of those its sounds are placed on, with the sounds they play. */
  readonly declaredMoments: string[];
  readonly sounds: Array<{ spot: { kind: string; momentId?: string }; soundId: string }>;
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  const bundle = await bundleForThePage();
  page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({ content: bundle });
  await page.addScriptTag({ content: PLAY_HELPER });
}, 120_000);

afterAll(async () => { await browser.close(); });

// Opens each preset on a stage the size of its box on a 1080 × 1920 frame, with its fields' defaults, and asks for each moment.
const PLAY_HELPER = `
window.playAll = async (moments) => {
  const factory = new fixture.SandboxedGraphicPlayerFactory(document.body, new fixture.SandboxedGraphicPage(), { build: async () => '' });
  const played = [];
  for (const preset of new fixture.BuiltinGraphicPresetCatalog().list()) {
    const { graphic, box } = preset;
    const widthPx = Math.round(1080 * (box.kind === 'full' ? 1 : box.width));
    const heightPx = box.kind === 'full' ? 1920 : Math.round(widthPx / graphic.aspectRatio);
    const params = Object.fromEntries(graphic.fields.map((field) => [field.id, field.defaultValue]));
    const errors = [];
    const player = await factory.open(graphic.document, { widthPx, heightPx, fps: 30, seed: 1, durationSec: 3, params }, (message) => {
      if (message.level !== 'log') errors.push(message.text);
    });
    const declaredMoments = player.moments.map((moment) => moment.id);
    const drawnShares = [];
    for (const moment of moments) {
      const bitmap = await player.frameAt(moment);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let drawn = 0;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 0) drawn += 1;
      drawnShares.push(drawn / (data.length / 4));
    }
    player.dispose();
    played.push({ id: preset.id, drawnShares, errors, declaredMoments, sounds: preset.sounds });
  }
  return played;
};
`;

function fixturePlugin(): Plugin {
  const fixture = `\0${FIXTURE_ID}`;
  return {
    name: 'graphic-presets-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? fixture : null),
    load: (id) => (id === fixture
      ? `export { SandboxedGraphicPlayerFactory } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPlayerFactory';
export { SandboxedGraphicPage } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPage';
export { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';`
      : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixturePlugin()],
    resolve: { alias: { '@core': resolve(STUDIO_SRC, 'core') } },
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

describe('the graphic presets shipped', () => {
  it('are all there, the lower third first', async () => {
    const played = await page.evaluate((moments) => (window as unknown as { playAll: (moments: number[]) => Promise<Played[]> }).playAll(moments), MOMENTS);

    expect(played.map(({ id }) => id)).toEqual([
      'lower-third', 'speaker-minimal', 'follow-card', 'comment-card', 'comment-reply', 'message-card', 'link-card', 'subscribe',
      'progress-bar', 'key-number', 'key-phrase', 'contrast', 'list-item', 'section-title', 'quote', 'place',
      'hook-headline', 'hook-accent-card', 'hook-keyword-stack', 'hook-scribble', 'hook-big-word', 'hook-emoji',
      'hook-stacked', 'hook-neon-script', 'hook-boxed-lines', 'text-plain',
    ]);
    for (const { id, drawnShares, errors } of played) {
      expect(errors, id).toEqual([]);
      // Past its first moments every preset shows something; the progress bar starts empty but its track shows.
      expect(drawnShares.slice(1).every((share) => share > 0.01), `${id}: ${drawnShares.join(', ')}`).toBe(true);
    }
  }, 60_000);

  it('each sit in a family of the presets panel', () => {
    for (const { id, category } of new BuiltinGraphicPresetCatalog().list()) expect(category, id).not.toBeNull();
  });

  it('recommend an exit from the layer motion library, with only the fields it offers, and leave the entrance to their code', () => {
    const library = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);

    for (const { id, motion } of new BuiltinGraphicPresetCatalog().list()) {
      expect(motion.entrance, id).toBeNull();
      const exit = library.byId(motion.exit?.presetId ?? '');
      expect(exit, id).not.toBeNull();
      expect(Object.keys(motion.exit!.params).every((field) => exit!.controls.some((control) => control.id === field)), id).toBe(true);
    }
  });

  it('bring their sounds only on moments their code declares, each a bundled sound', async () => {
    const played = await page.evaluate((moments) => (window as unknown as { playAll: (moments: number[]) => Promise<Played[]> }).playAll(moments), MOMENTS);
    const bundled = new Set(BUILTIN_SOUND_PACK.map((sound) => sound.id));

    expect(played.filter(({ sounds }) => sounds.length > 0).map(({ id }) => id)).toEqual(['follow-card', 'comment-card', 'message-card', 'subscribe', 'hook-headline', 'hook-scribble', 'hook-emoji']);
    for (const { id, declaredMoments, sounds } of played) {
      for (const { spot, soundId } of sounds) {
        expect(spot.kind, `${id} plays ${soundId}`).toBe('moment');
        expect(declaredMoments, `${id} plays ${soundId} on ${spot.momentId}`).toContain(spot.momentId);
        expect(bundled.has(soundId), `${id}: ${soundId}`).toBe(true);
      }
    }
  }, 60_000);
});
