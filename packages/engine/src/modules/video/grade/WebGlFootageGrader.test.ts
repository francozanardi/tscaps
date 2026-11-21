import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import type { FootageGrade } from '@modules/video/grade/FootageGrade';

/**
 * What a grade does to a picture, asked of the GPU that grades it.
 *
 * A shader is correct because a GPU says so, so Chromium grades a
 * canvas of known pixels and the test reads them back: neutral leaves
 * them, each term moves them the way its range promises, and the
 * vignette darkens the corners and leaves the centre.
 */

const FIXTURE_ID = 'virtual:footage-grader-fixture';
const FIXTURE_SOURCE = `
  export { WebGlFootageGrader } from '@modules/video/grade/WebGlFootageGrader';
  export { CanvasFilterFootageGrader } from '@modules/video/grade/CanvasFilterFootageGrader';
  export { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';
`;
const NEUTRAL: FootageGrade = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, vignette: 0 };

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: await bundleForThePage() });
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'footage-grader-fixture',
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

/** The pixels at the centre and at a corner of a 64×64 canvas of `color`, after `grade`, through the GPU or the plain canvas. */
async function graded(
  color: readonly [number, number, number],
  grade: Partial<FootageGrade>,
  through: 'gpu' | 'canvas' = 'gpu',
): Promise<{ centre: number[]; corner: number[] }> {
  return page.evaluate(({ color, grade, through }) => {
    const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
    const math = new fixture.FootageGradeMath!();
    const canvasGrader = new fixture.CanvasFilterFootageGrader!(math);
    const grader = (through === 'gpu' ? new fixture.WebGlFootageGrader!(math, canvasGrader) : canvasGrader) as {
      grade(context: OffscreenCanvasRenderingContext2D, width: number, height: number, grade: unknown): void;
    };
    const canvas = new OffscreenCanvas(64, 64);
    const context = canvas.getContext('2d')!;
    context.fillStyle = `rgb(${color.join(', ')})`;
    context.fillRect(0, 0, 64, 64);
    grader.grade(context, 64, 64, grade);
    const at = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
    return { centre: at(32, 32), corner: at(0, 0) };
  }, { color, grade: { ...NEUTRAL, ...grade }, through });
}

function expectNear(actual: number[], expected: number[], tolerance = 3): void {
  actual.forEach((value, index) => expect(Math.abs(value - expected[index]!)).toBeLessThanOrEqual(tolerance));
}

describe('WebGlFootageGrader', () => {
  it('leaves a picture as it is under a neutral grade', async () => {
    expect((await graded([120, 80, 40], {})).centre).toEqual([120, 80, 40]);
  });

  it('doubles the picture a stop brighter, and halves it a stop darker', async () => {
    expectNear((await graded([60, 40, 20], { exposure: 1 })).centre, [120, 80, 40]);
    expectNear((await graded([120, 80, 40], { exposure: -1 })).centre, [60, 40, 20]);
  });

  it('takes a colour to its grey with no saturation', async () => {
    const [red, green, blue] = (await graded([200, 100, 50], { saturation: -1 })).centre;

    expect(Math.abs(red! - green!)).toBeLessThanOrEqual(1);
    expect(Math.abs(green! - blue!)).toBeLessThanOrEqual(1);
  });

  it('warms by raising red and lowering blue, and cools the other way', async () => {
    const [warmRed, , warmBlue] = (await graded([128, 128, 128], { temperature: 1 })).centre;
    const [coolRed, , coolBlue] = (await graded([128, 128, 128], { temperature: -1 })).centre;

    expect(warmRed!).toBeGreaterThan(128);
    expect(warmBlue!).toBeLessThan(128);
    expect(coolRed!).toBeLessThan(128);
    expect(coolBlue!).toBeGreaterThan(128);
  });

  it('pushes values away from mid grey with more contrast', async () => {
    const [dark] = (await graded([64, 64, 64], { contrast: 1 })).centre;
    const [light] = (await graded([192, 192, 192], { contrast: 1 })).centre;

    expect(dark!).toBeLessThan(10);
    expect(light!).toBeGreaterThan(245);
  });

  it('darkens the corners with a vignette and leaves the centre', async () => {
    const { centre, corner } = await graded([200, 200, 200], { vignette: 1 });

    expectNear(centre, [200, 200, 200]);
    expect(corner[0]!).toBeLessThan(40);
  });

  it('grades on the plain canvas once its context is lost, and on the GPU again after', async () => {
    const [lost, again] = await page.evaluate(({ grade }) => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
      const math = new fixture.FootageGradeMath!();
      const grader = new fixture.WebGlFootageGrader!(math, new fixture.CanvasFilterFootageGrader!(math)) as {
        grade(context: OffscreenCanvasRenderingContext2D, width: number, height: number, grade: unknown): void;
      };
      // Keeps the WebGL contexts the grader makes, so one can be lost as a GPU reset would lose it.
      const made: WebGL2RenderingContext[] = [];
      const getContext = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = function (this: OffscreenCanvas, ...args: Parameters<typeof getContext>) {
        const context = getContext.apply(this, args);
        if (args[0] === 'webgl2' && context !== null) made.push(context as WebGL2RenderingContext);
        return context;
      } as typeof getContext;
      const brightened = () => {
        const canvas = new OffscreenCanvas(64, 64);
        const context = canvas.getContext('2d')!;
        context.fillStyle = 'rgb(60, 40, 20)';
        context.fillRect(0, 0, 64, 64);
        grader.grade(context, 64, 64, grade);
        return [...context.getImageData(32, 32, 1, 1).data.slice(0, 3)];
      };
      brightened();
      made[0]!.getExtension('WEBGL_lose_context')!.loseContext();
      const whileLost = brightened();
      const afterwards = brightened();
      OffscreenCanvas.prototype.getContext = getContext;
      return [whileLost, afterwards];
    }, { grade: { ...NEUTRAL, exposure: 1 } });

    expectNear(lost!, [120, 80, 40], 6);
    expectNear(again!, [120, 80, 40]);
  });

  it('grades a canvas holding another origin\'s pixels on the plain canvas instead of throwing', async () => {
    const onePixelPng = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/png').split(',')[1]!;
    });
    await page.route('https://elsewhere.test/pixel.png', (route) => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(onePixelPng, 'base64'),
    }));
    const threw = await page.evaluate(async ({ grade }) => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => never> }).fixture;
      const math = new fixture.FootageGradeMath!();
      const grader = new fixture.WebGlFootageGrader!(math, new fixture.CanvasFilterFootageGrader!(math)) as {
        grade(context: CanvasRenderingContext2D, width: number, height: number, grade: unknown): void;
      };
      const elsewhere = new Image();
      elsewhere.src = 'https://elsewhere.test/pixel.png';
      await elsewhere.decode();
      const canvas = document.createElement('canvas');
      canvas.id = 'tainted';
      canvas.width = 64;
      canvas.height = 64;
      document.body.appendChild(canvas);
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'rgb(60, 40, 20)';
      context.fillRect(0, 0, 64, 64);
      context.drawImage(elsewhere, 0, 0);
      try {
        grader.grade(context, 64, 64, grade);
        return null;
      } catch (error) {
        return String(error);
      }
    }, { grade: { ...NEUTRAL, exposure: 1 } });
    // The canvas cannot be read back, so its pixels are read from what the page shows.
    const shown = (await page.locator('#tainted').screenshot()).toString('base64');
    const centre = await page.evaluate(async (png) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      document.getElementById('tainted')!.remove();
      return [...context.getImageData(32, 32, 1, 1).data.slice(0, 3)];
    }, shown);

    expect(threw).toBeNull();
    expectNear(centre, [120, 80, 40], 6);
  });

  it('is approximated on a plain canvas, the same way in direction', async () => {
    const brighter = await graded([60, 40, 20], { exposure: 1 }, 'canvas');
    const vignetted = await graded([200, 200, 200], { vignette: 1 }, 'canvas');

    expectNear(brighter.centre, [120, 80, 40], 6);
    expect(vignetted.corner[0]!).toBeLessThan(vignetted.centre[0]!);
  });
});
