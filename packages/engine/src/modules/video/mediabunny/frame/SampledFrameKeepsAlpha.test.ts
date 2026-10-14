import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That a frame sampled by a caption keeps its transparency when the
 * frames are transparent, asked of the browser that decodes the image.
 *
 * A caption that paints the video into its own raster gets the frame as
 * an encoded image. Encoded as JPEG, a transparent frame comes back
 * black, and every such caption carries a black box into a file meant to
 * be laid over other footage.
 */

const FIXTURE_ID = 'virtual:sampled-frame-fixture';
const FIXTURE_SOURCE = `
  export { BufferedVideoFrameSource } from '@modules/video/mediabunny/frame/BufferedVideoFrameSource';
`;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('a sampled frame', () => {
  it('stays transparent where the frame is, and opaque where it is painted, when frames have alpha', async () => {
    const read = await sampleInPage(true);
    expect(read.clearAlpha).toBe(0);
    expect(read.paintedAlpha).toBe(255);
    expect(read.paintedRed).toBeGreaterThan(200);
  });

  it('is opaque when frames have no alpha, as an opaque video always is', async () => {
    const read = await sampleInPage(false);
    expect(read.clearAlpha).toBe(255);
  });
});

interface SampleRead {
  /** Alpha of a pixel the frame left clear. */
  clearAlpha: number;
  /** Alpha and red of a pixel the frame painted opaque red. */
  paintedAlpha: number;
  paintedRed: number;
}

async function sampleInPage(withAlpha: boolean): Promise<SampleRead> {
  const page = await browser.newPage();
  try {
    await page.setContent('<title>sampled frame</title>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(sampleFrameInPage, withAlpha);
  } finally {
    await page.close();
  }
}

/** Samples a 64×64 frame whose left half is clear and right half opaque red, and decodes the image it came back as. */
async function sampleFrameInPage(withAlpha: boolean): Promise<SampleRead> {
  const fixture = (window as unknown as { fixture: unknown }).fixture as {
    BufferedVideoFrameSource: new (width: number, height: number, withAlpha: boolean) => {
      hold: (frames: ReadonlyArray<{ time: number; frame: unknown }>) => void;
      getFrameAt: (time: number, quality: number) => Promise<string>;
    };
  };
  const frame = {
    timestamp: 0,
    duration: 1,
    draw: (context: CanvasRenderingContext2D, dx: number, dy: number, width: number, height: number) => {
      context.clearRect(dx, dy, width, height);
      context.fillStyle = '#ff0000';
      context.fillRect(dx + width / 2, dy, width / 2, height);
    },
    close: () => {},
  };
  const source = new fixture.BufferedVideoFrameSource(64, 64, withAlpha);
  source.hold([{ time: 0, frame }]);
  const url = await source.getFrameAt(0, 0.9);
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const clear = context.getImageData(16, 32, 1, 1).data;
  const painted = context.getImageData(48, 32, 1, 1).data;
  return { clearAlpha: clear[3]!, paintedAlpha: painted[3]!, paintedRed: painted[0]! };
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'sampled-frame-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '..', '..', '..') } },
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
