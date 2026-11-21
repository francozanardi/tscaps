import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * What the sampler promises about the frames it hands out, asked of a
 * real browser, whose decoder is the oracle. The fixture is four
 * seconds of 1280×720 video at 30 frames a second, one colour a second:
 * red, green, blue, white; its rotated copy carries a 90° display
 * rotation, as a phone held upright writes it.
 *
 * The page is served on `http://localhost` through route interception
 * because WebCodecs only exists in secure contexts.
 */

interface SampledFrameSummary {
  readonly sourceSec: number;
  readonly width: number;
  readonly height: number;
  readonly colour: string;
}

const FIXTURE_ID = 'virtual:frame-sampler-fixture';
const FIXTURE_SOURCE = `export { MediaBunnyFrameSampler } from '@core/subject-tracking/infrastructure/MediaBunnyFrameSampler';`;
const FRAME_SEC = 1 / 30;

let browser: Browser;
let bundle: string;
let uprightBase64: string;
let rotatedBase64: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
  uprightBase64 = await readFixture('avc-720p-four-colours.mp4');
  rotatedBase64 = await readFixture('avc-720p-four-colours-rotated.mp4');
}, 120_000);

afterAll(async () => { await browser.close(); });

async function readFixture(name: string): Promise<string> {
  return (await readFile(resolve(import.meta.dirname, '../../_shared/fixtures', name))).toString('base64');
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'frame-sampler-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@core': resolve(import.meta.dirname, '../..') } },
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

async function pageWithSampler(): Promise<Page> {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('http://localhost/frame-sampler-test');
  await page.addScriptTag({ content: bundle });
  return page;
}

/** Every frame the sampler hands out for `stretches`, each with its size and the colour at its middle. */
async function sampled(
  base64: string,
  stretches: ReadonlyArray<{ startSec: number; endSec: number; framesPerSecond: number }>,
): Promise<SampledFrameSummary[]> {
  const page = await pageWithSampler();
  try {
    return await page.evaluate(async ({ base64, stretches }) => {
      type Sampler = { sample(video: Blob, stretches: unknown, signal: AbortSignal): AsyncGenerator<{ sourceSec: number; bitmap: ImageBitmap }> };
      const fixture = (window as never as { fixture: { MediaBunnyFrameSampler: new () => Sampler } }).fixture;
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const frames = [];
      for await (const frame of new fixture.MediaBunnyFrameSampler().sample(new Blob([bytes], { type: 'video/mp4' }), stretches, new AbortController().signal)) {
        const canvas = new OffscreenCanvas(frame.bitmap.width, frame.bitmap.height);
        const context = canvas.getContext('2d')!;
        context.drawImage(frame.bitmap, 0, 0);
        const [red, green, blue] = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
        const colour = red! > 200 && green! > 200 && blue! > 200 ? 'white' : red! > 200 ? 'red' : green! > 200 ? 'green' : blue! > 200 ? 'blue' : 'other';
        frames.push({ sourceSec: frame.sourceSec, width: frame.bitmap.width, height: frame.bitmap.height, colour });
        frame.bitmap.close();
      }
      return frames;
    }, { base64, stretches });
  } finally {
    await page.close();
  }
}

describe('MediaBunnyFrameSampler', () => {
  it('hands out the frames shown at the stretch\'s start and at its rate after it', async () => {
    const frames = await sampled(uprightBase64, [{ startSec: 0.5, endSec: 3.5, framesPerSecond: 2 }]);
    const wanted = [0.5, 1, 1.5, 2, 2.5, 3];
    expect(frames).toHaveLength(wanted.length);
    frames.forEach((frame, index) => {
      expect(frame.sourceSec).toBeLessThanOrEqual(wanted[index]! + 1e-6);
      expect(frame.sourceSec).toBeGreaterThan(wanted[index]! - FRAME_SEC - 1e-6);
    });
    expect(frames.map((frame) => frame.colour)).toEqual(['red', 'green', 'green', 'blue', 'blue', 'white']);
  });

  it('reads each stretch in turn, and nothing between them', async () => {
    const frames = await sampled(uprightBase64, [
      { startSec: 0.2, endSec: 0.8, framesPerSecond: 1 },
      { startSec: 3.2, endSec: 3.8, framesPerSecond: 1 },
    ]);
    expect(frames.map((frame) => frame.colour)).toEqual(['red', 'white']);
  });

  it('draws the frames at most 480 pixels on their short side', async () => {
    const [frame] = await sampled(uprightBase64, [{ startSec: 1, endSec: 1.5, framesPerSecond: 1 }]);
    expect(frame).toMatchObject({ width: 853, height: 480 });
  });

  it('turns a video recorded with a rotation upright', async () => {
    const [frame] = await sampled(rotatedBase64, [{ startSec: 1, endSec: 1.5, framesPerSecond: 1 }]);
    expect(frame).toMatchObject({ width: 480, height: 853 });
  });
});
