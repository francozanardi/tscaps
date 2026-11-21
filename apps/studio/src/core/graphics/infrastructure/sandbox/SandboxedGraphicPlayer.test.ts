import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';

/**
 * A graphic played in its sandboxed frame, in Chromium. The promises: the
 * same time draws the same picture whatever was asked before; time is the
 * editor's, for code written against frame callbacks, timers, CSS
 * animations or a pure function of time; and nothing the graphic runs
 * reaches the editor's storage, its DOM or the network.
 */

const STUDIO_SRC = resolve(__dirname, '../../../..');
const FIXTURE_ID = 'graphics-fixture';
const ORIGIN = 'http://editor.test';

/**
 * What one play of a graphic gave: a fingerprint and the colour at each point asked, per time asked, what it
 * logged, and the moments its code declared.
 */
interface Played {
  frames: Array<{ hash: number; colors: number[][]; widthPx: number; heightPx: number; text: { smallest: { text: string; px: number } | null; cut: string[] } | null }>;
  logs: string[];
  moments: Array<{ id: string; label: string; sec: number }>;
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  const bundle = await bundleForThePage();
  page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(() => {
    localStorage.setItem('session', 'secret');
    document.cookie = 'session=secret';
  });
  await page.addScriptTag({ content: bundle });
  await page.addScriptTag({ content: PLAY_HELPER });
}, 120_000);

afterAll(async () => { await browser.close(); });

// Opens a graphic, asks it for each time in turn and reads each picture back, then closes it.
const PLAY_HELPER = `
window.play = async (graphic, stage, times, points, fontFaceCss, pictureScale) => {
  const fontFaces = { build: async () => fontFaceCss };
  const factory = new fixture.SandboxedGraphicPlayerFactory(document.body, new fixture.SandboxedGraphicPage(), fontFaces);
  const logs = [];
  const player = await factory.open(graphic, stage, (message) => logs.push(message.level + ': ' + message.text), pictureScale);
  const frames = [];
  for (const time of times) {
    // The cause names what went wrong inside the frame; the error itself only names the operation.
    const bitmap = await player.frameAt(time).catch((error) => { throw new Error(error.message + ': ' + (error.cause?.message ?? error.cause) + ' | ' + logs.join(' | ')); });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let index = 0; index < data.length; index += 1) hash = (Math.imul(hash, 31) + data[index]) | 0;
    const colors = points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    frames.push({ hash, colors, widthPx: bitmap.width, heightPx: bitmap.height, text: player.textLayout() });
  }
  const moments = player.moments;
  player.dispose();
  return { frames, logs, moments };
};
`;

function fixturePlugin(): Plugin {
  const fixture = `\0${FIXTURE_ID}`;
  return {
    name: 'graphics-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? fixture : null),
    load: (id) => (id === fixture
      ? `export { SandboxedGraphicPlayerFactory } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPlayerFactory';
export { SandboxedGraphicPage } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPage';`
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

const STAGE: GraphicStage = { widthPx: 200, heightPx: 100, fps: 30, seed: 7, durationSec: 4, params: {} };
const RED = [255, 0, 0, 255];
const NOTHING = [0, 0, 0, 0];

function play(
  graphic: GraphicDocument,
  times: number[],
  points: Array<[number, number]> = [],
  stage: GraphicStage = STAGE,
  fontFaceCss = '',
  pictureScale = 1,
): Promise<Played> {
  return page.evaluate(
    ([graphic, stage, times, points, fontFaceCss, pictureScale]) => (window as unknown as { play: (...args: unknown[]) => Promise<Played> })
      .play(graphic, stage, times, points, fontFaceCss, pictureScale),
    [graphic, stage, times, points, fontFaceCss, pictureScale] as const,
  );
}

/** A canvas a script draws a red square on, at the left `x(t)` gives. */
function canvasGraphic(js: string): GraphicDocument {
  return {
    html: '<canvas id="stage" width="200" height="100"></canvas>',
    css: '',
    js: `const context = document.getElementById('stage').getContext('2d');
const square = (x) => { context.clearRect(0, 0, 200, 100); context.fillStyle = 'red'; context.fillRect(x, 0, 10, 10); };
${js}`,
  };
}

describe('a graphic drawn as a pure function of time', () => {
  const graphic = canvasGraphic('tscaps.render = (t) => square(t * 100);');

  it('draws the time asked', async () => {
    const { frames } = await play(graphic, [0.5, 1], [[55, 5], [5, 5], [105, 5]]);

    expect(frames[0]!.colors).toEqual([RED, NOTHING, NOTHING]);
    expect(frames[1]!.colors).toEqual([NOTHING, NOTHING, RED]);
  });

  it('draws the same picture for the same time, whatever was asked before', async () => {
    const { frames } = await play(graphic, [1, 0.5, 1, 2, 1], []);

    expect(new Set([frames[0]!.hash, frames[2]!.hash, frames[4]!.hash]).size).toBe(1);
    expect(frames[1]!.hash).not.toBe(frames[0]!.hash);
  });
});

describe('a graphic written against frame callbacks', () => {
  // Two pixels per frame, from the first frame on: at 30 fps, 62 px one second in.
  const graphic = canvasGraphic('let x = 0; const loop = () => { square(x); x += 2; requestAnimationFrame(loop); }; requestAnimationFrame(loop);');

  it('runs one callback per frame of its own clock, however long a frame takes to draw', async () => {
    const { frames } = await play(graphic, [1], [[63, 5], [59, 5]]);

    expect(frames[0]!.colors).toEqual([RED, NOTHING]);
  });

  it('plays again from its start to go back, so a time drawn twice matches', async () => {
    const straight = await play(graphic, [1], []);
    const roundabout = await play(graphic, [2, 0.5, 1], []);

    expect(roundabout.frames[2]!.hash).toBe(straight.frames[0]!.hash);
  });
});

describe('a graphic written against timers and the clock', () => {
  it('runs a timer when its time comes on the graphic\'s clock', async () => {
    const graphic = canvasGraphic('setTimeout(() => square(50), 500);');

    const { frames } = await play(graphic, [0.4, 0.6], [[55, 5]]);

    expect(frames[0]!.colors).toEqual([NOTHING]);
    expect(frames[1]!.colors).toEqual([RED]);
  });

  it('reads the same time and the same chance in every run, from its seed', async () => {
    const graphic = canvasGraphic('tscaps.render = () => square(Math.floor(Math.random() * 190) + (Date.now() % 7));');

    const first = await play(graphic, [0.5], []);
    const again = await play(graphic, [0.5], []);
    const otherSeed = await play(graphic, [0.5], [], { ...STAGE, seed: 8 });

    expect(again.frames[0]!.hash).toBe(first.frames[0]!.hash);
    expect(otherSeed.frames[0]!.hash).not.toBe(first.frames[0]!.hash);
  });
});

describe('a graphic made of HTML and CSS', () => {
  const box = { html: '<div class="box"></div>', js: '' };

  it('holds a CSS animation at the time asked', async () => {
    const graphic = { ...box, css: '.box { position: absolute; left: 0; top: 0; width: 10px; height: 10px; background: red; animation: move 1s linear forwards; } @keyframes move { to { left: 100px; } }' };

    const { frames } = await play(graphic, [0.5, 1], [[55, 5], [5, 5], [105, 5]]);

    expect(frames[0]!.colors).toEqual([RED, NOTHING, NOTHING]);
    expect(frames[1]!.colors).toEqual([NOTHING, NOTHING, RED]);
  });

  it('draws a canvas among its HTML with what was drawn on it', async () => {
    const graphic = {
      html: '<p class="label">Hi</p><canvas id="stage" width="200" height="100"></canvas>',
      css: '.label { position: absolute; margin: 0; left: 150px; top: 60px; width: 20px; height: 20px; background: red; } canvas { position: absolute; left: 0; top: 0; }',
      js: "tscaps.render = (t) => { const context = document.getElementById('stage').getContext('2d'); context.clearRect(0, 0, 200, 100); context.fillStyle = 'red'; context.fillRect(t * 100, 0, 10, 10); };",
    };

    const { frames } = await play(graphic, [0.5], [[55, 5], [160, 70], [5, 5]]);

    expect(frames[0]!.colors).toEqual([RED, RED, NOTHING]);
  });

  it('lays out in its box, which is its whole viewport', async () => {
    const graphic = { ...box, css: '.box { position: absolute; right: 0; bottom: 0; width: 50vw; height: 50vh; background: red; }' };

    const { frames } = await play(graphic, [0], [[150, 75], [50, 25]]);

    expect(frames[0]!.colors).toEqual([RED, NOTHING]);
  });
});

describe('a graphic whose page stands still between frames', () => {
  // A red square that holds its place for the first second, then jumps a hundred pixels to the right.
  const graphic = {
    html: '<div class="square"></div>',
    css: '.square { position: absolute; top: 0; width: 10px; height: 10px; background: red; }',
    js: "const square = document.querySelector('.square'); tscaps.render = (t) => { square.style.left = (t < 1 ? 20 : 120) + 'px'; };",
  };

  it('draws the picture of each time asked, through frames that changed nothing and back', async () => {
    const { frames } = await play(graphic, [0, 0.5, 0.9, 1.2, 1.5, 0.5], [[25, 5], [125, 5]]);

    expect(frames.map((frame) => frame.colors)).toEqual([
      [RED, NOTHING], [RED, NOTHING], [RED, NOTHING], [NOTHING, RED], [NOTHING, RED], [RED, NOTHING],
    ]);
  });

  it('hands over a picture of its own each time, the caller\'s to close', async () => {
    const closedThenReadAgain = await page.evaluate(async ([graphic, stage]) => {
      const fixture = (globalThis as unknown as { fixture: Record<string, new (...args: unknown[]) => unknown> }).fixture;
      const factory = new fixture.SandboxedGraphicPlayerFactory!(document.body, new fixture.SandboxedGraphicPage!(), { build: async () => '' }) as {
        open(...args: unknown[]): Promise<{ frameAt(sec: number): Promise<ImageBitmap>; dispose(): void }>;
      };
      const player = await factory.open(graphic, stage, () => undefined, 1);
      const first = await player.frameAt(0);
      first.close();
      const second = await player.frameAt(0.5);
      const canvas = new OffscreenCanvas(second.width, second.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(second, 0, 0);
      const color = Array.from(context.getImageData(25, 5, 1, 1).data);
      player.dispose();
      return { color, widthPx: second.width };
    }, [graphic, STAGE] as const);

    expect(closedThenReadAgain).toEqual({ color: RED, widthPx: 200 });
  });
});

describe('a graphic asked for smaller pictures', () => {
  const html = {
    html: '<div class="half"></div>',
    css: '.half { position: absolute; left: 50vw; top: 0; width: 50vw; height: 100vh; background: red; }',
    js: '',
  };

  it('hands over the same picture in fewer pixels, laid out in its box all the same', async () => {
    const { frames } = await play(html, [0], [[75, 25], [25, 25]], STAGE, '', 0.5);

    expect([frames[0]!.widthPx, frames[0]!.heightPx]).toEqual([100, 50]);
    expect(frames[0]!.colors).toEqual([RED, NOTHING]);
  });

  it('does so for a graphic drawn on one canvas too', async () => {
    const { frames } = await play(canvasGraphic('tscaps.render = () => square(100);'), [0], [[52, 2], [20, 2]], STAGE, '', 0.5);

    expect([frames[0]!.widthPx, frames[0]!.heightPx]).toEqual([100, 50]);
    expect(frames[0]!.colors).toEqual([RED, NOTHING]);
  });

  it('never hands over more pixels than its box has', async () => {
    const { frames } = await play(html, [0], [], STAGE, '', 3);

    expect([frames[0]!.widthPx, frames[0]!.heightPx]).toEqual([200, 100]);
  });
});

describe('a font handed to a graphic', () => {
  // A bundled face, as the editor hands it: its file held inline.
  const anton = readFileSync(resolve(STUDIO_SRC, '../node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2')).toString('base64');
  const fontFaceCss = `@font-face{font-family:'Anton';src:url(data:font/woff2;base64,${anton}) format('woff2')}`;

  it('draws a canvas\'s text from its first frame', async () => {
    const text = (family: string) => canvasGraphic(`tscaps.render = () => { context.clearRect(0, 0, 200, 100); context.fillStyle = 'red'; context.font = "80px '${family}'"; context.fillText('WWW', 0, 90); };`);

    const handed = await play(text('Anton'), [0], [], STAGE, fontFaceCss);
    const fallback = await play(text('Undeclared'), [0], [], STAGE, fontFaceCss);

    expect(handed.frames[0]!.hash).not.toBe(fallback.frames[0]!.hash);
  });

  it('draws the text of its HTML', async () => {
    const text = (family: string) => ({ html: '<p>WWW</p>', css: `p { margin: 0; font: 80px '${family}'; color: red; }`, js: '' });

    const handed = await play(text('Anton'), [0], [], STAGE, fontFaceCss);
    const fallback = await play(text('Undeclared'), [0], [], STAGE, fontFaceCss);

    expect(handed.frames[0]!.hash).not.toBe(fallback.frames[0]!.hash);
  });
});

describe('what a graphic says', () => {
  it('reports what its code logs and throws, and still draws', async () => {
    const graphic = canvasGraphic('console.log("hello", 2); tscaps.render = () => { square(0); throw new Error("broken"); };');

    const { frames, logs } = await play(graphic, [0], [[5, 5]]);

    expect(frames[0]!.colors).toEqual([RED]);
    expect(logs).toContain('log: hello 2');
    expect(logs.some((line) => line.startsWith('error: Error: broken'))).toBe(true);
  });

  it('keeps text that closes a tag inside its code as text', async () => {
    const graphic = canvasGraphic('const text = "</script><b>x</b>"; console.log(text.length); tscaps.render = () => square(0);');

    const { logs } = await play(graphic, [0], []);

    expect(logs).toContain('log: 17');
  });

  it('hands its code its fields, its length and its box', async () => {
    const graphic = canvasGraphic('console.log(tscaps.params.title, tscaps.duration, tscaps.width, tscaps.height);');

    const { logs } = await play(graphic, [0], [], { ...STAGE, params: { title: 'Follow' } });

    expect(logs).toContain('log: Follow 4 200 100');
  });
});

describe('a graphic in a frame given its size late', () => {
  it('runs its code only once its viewport is its box', async () => {
    // As Chrome has been seen doing for a sandboxed frame out of view: the page is parsed at 0 × 0 and sized after.
    const seen = await page.evaluate(({ stage }) => new Promise<number[]>((resolve) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.style.cssText = 'position:fixed;left:0;top:0;border:0;width:0;height:0;';
      document.body.append(frame);
      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || !Array.isArray(event.data)) return;
        window.removeEventListener('message', onMessage);
        frame.remove();
        resolve(event.data as number[]);
      };
      window.addEventListener('message', onMessage);
      const graphic = { html: '', css: '', js: 'parent.postMessage([innerWidth, innerHeight], "*");' };
      const fixture = (window as unknown as { fixture: { SandboxedGraphicPage: new () => { build: (graphic: unknown, stage: unknown, fontFaceCss: string, picture: unknown) => string } } }).fixture;
      frame.srcdoc = new fixture.SandboxedGraphicPage().build(graphic, stage, '', { widthPx: stage.widthPx, heightPx: stage.heightPx });
      setTimeout(() => {
        frame.style.width = `${stage.widthPx}px`;
        frame.style.height = `${stage.heightPx}px`;
      }, 300);
    }), { stage: STAGE });

    expect(seen).toEqual([STAGE.widthPx, STAGE.heightPx]);
  });

  it('takes a viewport a pixel off its box as its box, without waiting', async () => {
    // As a browser zoom leaves it: the frame's size is rounded in device pixels.
    const waitedMs = await page.evaluate(({ stage }) => new Promise<number>((resolve) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.style.cssText = `position:fixed;left:0;top:0;border:0;width:${stage.widthPx - 1}px;height:${stage.heightPx + 1}px;`;
      document.body.append(frame);
      const startedMs = performance.now();
      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data !== 'ran') return;
        window.removeEventListener('message', onMessage);
        frame.remove();
        resolve(performance.now() - startedMs);
      };
      window.addEventListener('message', onMessage);
      const graphic = { html: '', css: '', js: 'parent.postMessage("ran", "*");' };
      const fixture = (window as unknown as { fixture: { SandboxedGraphicPage: new () => { build: (graphic: unknown, stage: unknown, fontFaceCss: string, picture: unknown) => string } } }).fixture;
      frame.srcdoc = new fixture.SandboxedGraphicPage().build(graphic, stage, '', { widthPx: stage.widthPx, heightPx: stage.heightPx });
    }), { stage: STAGE });

    expect(waitedMs).toBeLessThan(1000);
  });
});

describe('a graphic\'s moments', () => {
  it('are what its code declared as it first ran, each with its name and second', async () => {
    const graphic = canvasGraphic([
      'const PRESS = 1.3;',
      'tscaps.moment("press", PRESS, "Button pressed");',
      'tscaps.moment("land", tscaps.duration - 0.5);',
      'tscaps.render = () => square(0);',
    ].join('\n'));

    const { moments } = await play(graphic, [0], []);

    expect(moments).toEqual([
      { id: 'press', label: 'Button pressed', sec: 1.3 },
      { id: 'land', label: 'land', sec: STAGE.durationSec - 0.5 },
    ]);
  });

  it('say what is wrong with one it cannot keep, and keep none declared once it plays', async () => {
    const graphic = canvasGraphic([
      'tscaps.moment("press");',
      'tscaps.moment("a moment", 1);',
      'tscaps.render = () => { tscaps.moment("late", 2); square(0); };',
    ].join('\n'));

    const { moments, logs } = await play(graphic, [0], []);

    expect(moments).toEqual([]);
    expect(logs).toEqual([
      expect.stringMatching(/^warn: tscaps\.moment\('press'\): give the second it happens/),
      expect.stringMatching(/^warn: tscaps\.moment: the id must be a short name/),
      expect.stringMatching(/^warn: tscaps\.moment\('late'\) was called after the graphic started/),
    ]);
  });
});

describe('a graphic kept apart from the editor', () => {
  it('reads none of the editor\'s storage, cookies or DOM, and reaches no network', async () => {
    const attempt = (label: string, code: string) => `try { ${code}; console.log('${label}: reached'); } catch (error) { console.log('${label}: refused'); }`;
    const graphic = canvasGraphic([
      attempt('storage', 'localStorage.getItem("session")'),
      attempt('cookie', 'if (document.cookie.includes("secret")) throw 0; throw new Error("none")'),
      attempt('parent', 'window.parent.document.body'),
      attempt('database', 'indexedDB.open("x")'),
      'fetch("https://example.com/").then(() => console.log("network: reached"), () => console.log("network: refused"));',
      'tscaps.render = () => square(0);',
    ].join('\n'));

    const { logs } = await play(graphic, [0, 0.1], []);

    expect(logs).toEqual(expect.arrayContaining([
      'log: storage: refused',
      'log: cookie: refused',
      'log: parent: refused',
      'log: database: refused',
      'log: network: refused',
    ]));
    expect(await page.evaluate(() => localStorage.getItem('session'))).toBe('secret');
  });
});

describe('the text of a graphic\'s page', () => {
  it('measures the smallest text it shows, and names the text its box cuts', async () => {
    const played = await play({
      html: '<p class="small">tiny label</p><p class="wide">a line far too long for this box</p><p class="gone">hidden</p>',
      css: 'body { margin: 0; } p { margin: 0; white-space: nowrap; font-size: 20px; } .small { font-size: 9px; } .gone { opacity: 0; font-size: 4px; }',
      js: '',
    }, [1]);

    expect(played.frames[0]?.text).toEqual({ smallest: { text: 'tiny label', px: 9 }, cut: ['a line far too long for this box'] });
  });

  it('names text cut by an element that clips it, and counts a scaled text at the size it is drawn', async () => {
    const played = await play({
      html: '<div class="window"><span class="big">clipped words in a narrow window</span></div><p class="scaled">half</p>',
      css: 'body { margin: 0; } .window { width: 60px; overflow: hidden; white-space: nowrap; font-size: 16px; } .scaled { margin: 0; font-size: 20px; transform: scale(0.5); }',
      js: '',
    }, [1]);

    expect(played.frames[0]?.text).toEqual({ smallest: { text: 'half', px: 10 }, cut: ['clipped words in a narrow window'] });
  });

  it('takes letters set tight inside the box for whole, though their line runs past it, and letters pushed out of it for cut', async () => {
    const played = await play({
      html: '<p class="tight">50</p><p class="out">50</p>',
      css: 'body { margin: 0; } p { margin: 0; font: 900 80px sans-serif; } .tight { line-height: 0.85; } .out { position: absolute; left: 100px; top: -40px; line-height: 1; }',
      js: '',
    }, [1]);

    expect(played.frames[0]?.text?.cut).toEqual(['50']);
  });
});
