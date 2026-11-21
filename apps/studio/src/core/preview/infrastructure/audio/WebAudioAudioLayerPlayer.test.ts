import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * What the preview plays is what Web Audio renders, so it is asked of a
 * real one: the player is driven in a page against an
 * `OfflineAudioContext`, on the canvas surface's clock, and the rendered
 * samples are read back.
 *
 * The oracle for loudness is the engine's `AudioGainEnvelope`, which the
 * export's mix is proven to follow sample for sample: the preview and
 * the export agree when the render here follows it too. Each file is a
 * WAV of known samples, decoded whole or streamed, so both ways the
 * player reads a file are held to the same answer.
 *
 * Gestures land on the offline context's timeline through `suspend`:
 * the context waits while the page plays, seeks or stops, so what the
 * player schedules then is heard exactly from that moment. The context
 * can only wait at the edge of a render quantum (128 frames), so every
 * gesture is made at one ({@link GESTURE_SEC}).
 *
 * The page is served on `http://localhost` through route interception
 * because WebCodecs only exists in secure contexts.
 */

const FIXTURE_ID = 'virtual:audio-layer-player-fixture';
const FIXTURE_SOURCE = `
  import {
    AudioGainEnvelope,
    FallbackAudioLayerDecoder,
    MediaBunnyAudioLayerDecoder,
    WebAudioAudioLayerDecoder,
  } from '@tscaps/engine/advanced';
  import { WebAudioAudioLayerPlayer } from '@core/preview/infrastructure/audio/WebAudioAudioLayerPlayer';
  import { WebAudioInputLevel } from '@core/preview/infrastructure/audio/WebAudioInputLevel';
  import { MediaBunnyPreviewAudioSourceOpener } from '@core/preview/infrastructure/mediabunny/MediaBunnyPreviewAudioSourceOpener';
  import { AudioContextPlaybackClock } from '@core/preview/infrastructure/AudioContextPlaybackClock';

  const RATE = 48000;

  function wav(samples) {
    const bytes = new DataView(new ArrayBuffer(44 + samples.length * 4));
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) bytes.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); bytes.setUint32(4, 36 + samples.length * 4, true); text(8, 'WAVE'); text(12, 'fmt ');
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 3, true); bytes.setUint16(22, 1, true);
    bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 32, true);
    text(36, 'data'); bytes.setUint32(40, samples.length * 4, true);
    samples.forEach((value, index) => bytes.setFloat32(44 + index * 4, value, true));
    return new Blob([bytes.buffer], { type: 'audio/wav' });
  }

  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

  /**
   * Plays layers from output 0 on a fresh offline context and renders it.
   * Each gesture happens with the context held at its moment, and the
   * context goes on once the page has had settleMs to schedule.
   */
  export async function render({ layers, renderSec, outputDurationSec = Infinity, streamLongerThanSec = 1e9, lookAheadSec = 1e9, playbackRate = 1, gestures = [], settleMs = 300, input = null }) {
    const context = new OfflineAudioContext(1, Math.round(renderSec * RATE), RATE);
    const clock = new AudioContextPlaybackClock(context);
    clock.setRate(playbackRate);
    clock.play(0);
    const decoder = new FallbackAudioLayerDecoder(new MediaBunnyAudioLayerDecoder(), new WebAudioAudioLayerDecoder());
    const player = new WebAudioAudioLayerPlayer(new MediaBunnyPreviewAudioSourceOpener(decoder, streamLongerThanSec), lookAheadSec, new WebAudioInputLevel());
    // The host's own sound: silent unless asked for, then a constant 1 through the level the player drives.
    const inputGain = context.createGain();
    inputGain.connect(context.destination);
    if (input !== null) {
      const own = context.createConstantSource();
      own.connect(inputGain);
      own.start(0);
    }
    player.mount(context, context.destination, clock, inputGain.gain);
    player.setLayers(layers, outputDurationSec);
    if (input !== null) player.setInputLevel(input.gain, input.ducks);
    player.playFrom(0);
    for (const gesture of gestures) {
      void context.suspend(gesture.atSec).then(async () => {
        if (gesture.kind === 'stop') { clock.pause(); player.stop(); }
        if (gesture.kind === 'seek') { clock.seek(gesture.toSec); player.playFrom(gesture.toSec); }
        if (gesture.kind === 'layers') player.setLayers(gesture.layers, outputDurationSec);
        if (gesture.kind === 'input') player.setInputLevel(gesture.gain, gesture.ducks);
        await sleep(settleMs);
        await context.resume();
      });
    }
    await sleep(settleMs);
    const rendered = await context.startRendering();
    player.unmount();
    return Array.from(rendered.getChannelData(0));
  }

  export function layer(samples, fields) {
    return {
      id: 'layer', source: wav(Float32Array.from(samples)), outputStartSec: 0, outputEndSec: Infinity, sourceStartSec: 0,
      sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null, ...fields,
    };
  }

  export function gainCurve(fields, outputDurationSec, sourceDurationSec, frames) {
    const envelope = new AudioGainEnvelope({ ...fields, source: new Blob() }, { outputDurationSec, sourceDurationSec });
    return Array.from({ length: frames }, (_, frame) => envelope.gainAt(frame / RATE));
  }
`;

const RATE = 48_000;
/** A moment on a render quantum's edge at 48 kHz (180 × 128 frames), where an offline context can wait. */
const GESTURE_SEC = 0.48;
/** A rendered sample differs from the expected one by float rounding at most; a misplaced or misshaped one by far more. */
const TOLERANCE = 1e-4;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

interface PageFixture {
  render(options: Record<string, unknown>): Promise<number[]>;
  layer(samples: ArrayLike<number>, fields: Record<string, unknown>): unknown;
  gainCurve(fields: Record<string, unknown>, outputDurationSec: number, sourceDurationSec: number, frames: number): number[];
}

declare global {
  function fixture(): PageFixture;
}

const BED = {
  outputStartSec: 0.5,
  outputEndSec: 2.3,
  gain: 0.8,
  fadeInSec: 0.2,
  fadeOutSec: 0.3,
  duck: { ranges: [{ startSec: 1, endSec: 1.2 }], gain: 0.25, attackSec: 0.1, releaseSec: 0.15 },
};

describe('the audio layers a preview plays', () => {
  for (const reading of ['decoded whole', 'streamed'] as const) {
    it(`follow the gain curve the export applies, through fades and a duck, from a file ${reading}`, async () => {
      const read = await inPage(async ({ rate, fields, streamLongerThanSec }) => {
        const { render, layer, gainCurve } = fixture();
        const constant = new Array(2 * rate).fill(1);
        const out = await render({ layers: [layer(constant, fields)], renderSec: 3, outputDurationSec: 3, streamLongerThanSec });
        const expected = gainCurve({ ...fields, sourceStartSec: 0, sourcePassSec: Infinity }, 3, 2, out.length);
        const worst = out.reduce((largest, value, frame) => Math.max(largest, Math.abs(value - expected[frame]!)), 0);
        return { worst, ducked: out[Math.round(1.1 * rate)] };
      }, { rate: RATE, fields: BED, streamLongerThanSec: reading === 'streamed' ? 1 : 1e9 });
      expect(read.ducked).toBeCloseTo(0.2, 4);
      expect(read.worst).toBeLessThan(TOLERANCE);
    });
  }

  it('drive the video\'s own level along the curve the export applies to it, lowered where asked', async () => {
    const read = await inPage(async ({ rate, gestureSec }) => {
      const { render } = fixture();
      const duck = { ranges: [{ startSec: 1, endSec: 1.5 }], gain: 0, attackSec: 0.1, releaseSec: 0.1 };
      const out = await render({
        layers: [],
        renderSec: 2,
        outputDurationSec: 2,
        input: { gain: 0.8, ducks: [duck] },
        gestures: [{ atSec: gestureSec, kind: 'input', gain: 0.5, ducks: [duck] }],
      });
      const at = (sec: number) => out[Math.round(sec * rate)]!;
      return { before: at(0.3), changed: at(0.7), rampDown: at(0.95), muted: at(1.25), rampUp: at(1.55), after: at(1.8) };
    }, { rate: RATE, gestureSec: GESTURE_SEC });
    expect(read.before).toBeCloseTo(0.8, 4);
    expect(read.changed).toBeCloseTo(0.5, 4);
    expect(read.rampDown).toBeCloseTo(0.25, 2);
    expect(read.muted).toBeCloseTo(0, 4);
    expect(read.rampUp).toBeCloseTo(0.25, 2);
    expect(read.after).toBeCloseTo(0.5, 4);
  });

  it('start their file over every pass from its in-point, silent for the part of a pass past the file', async () => {
    const read = await inPage(async ({ rate }) => {
      const { render, layer } = fixture();
      const ramp = Array.from({ length: rate / 4 }, (_, index) => (index + 1) / 100_000);
      const out = await render({
        layers: [layer(ramp, { outputStartSec: 0.2, outputEndSec: 1.9, sourceStartSec: 0.05, sourcePassSec: 0.3 })],
        renderSec: 2,
      });
      const [start, end, offset, pass] = [0.2 * rate, 1.9 * rate, 0.05 * rate, 0.3 * rate];
      let worst = 0;
      for (const [frame, value] of out.entries()) {
        const intoPass = (frame - start) % pass;
        // The first frames of a pass may land one frame either way of where the export puts them.
        if (frame >= start && (intoPass < 2 || pass - intoPass < 2)) continue;
        const inside = frame >= start && frame < end && offset + intoPass < ramp.length;
        worst = Math.max(worst, Math.abs(value - (inside ? ramp[offset + intoPass]! : 0)));
      }
      return { worst, passStarts: [0.5, 0.8, 1.1].map((sec) => out[Math.round(sec * rate) + 2]) };
    }, { rate: RATE });
    expect(read.worst).toBeLessThan(TOLERANCE);
    for (const value of read.passStarts) expect(value).toBeCloseTo(2403 / 100_000, 4);
  });

  it('play at the playback rate, landing where the output time falls on the clock', async () => {
    const read = await inPage(async ({ rate }) => {
      const { render, layer } = fixture();
      const out = await render({ layers: [layer(new Array(rate).fill(1), { outputStartSec: 1 })], renderSec: 1.5, playbackRate: 2 });
      const at = (sec: number) => out[Math.round(sec * rate)];
      return { before: at(0.45), during: [at(0.55), at(0.95)], after: at(1.05) };
    }, { rate: RATE });
    // At twice the speed, output second 1 is heard half a second in, and one second of file lasts half a second.
    expect(read).toEqual({ before: 0, during: [1, 1], after: 0 });
  });

  it('fall silent the moment playback stops', async () => {
    const read = await inPage(async ({ rate, atSec }) => {
      const { render, layer } = fixture();
      const out = await render({ layers: [layer(new Array(2 * rate).fill(1), {})], renderSec: 1.5, gestures: [{ kind: 'stop', atSec }] });
      return { before: out.slice(0, atSec * rate).every((value) => value === 1), after: out.slice(atSec * rate).every((value) => value === 0) };
    }, { rate: RATE, atSec: GESTURE_SEC });
    expect(read).toEqual({ before: true, after: true });
  });

  it('play from the new moment on a seek', async () => {
    const read = await inPage(async ({ rate, atSec }) => {
      const { render, layer } = fixture();
      const ramp = Array.from({ length: 3 * rate }, (_, index) => index / (3 * rate));
      const out = await render({ layers: [layer(ramp, {})], renderSec: 1, gestures: [{ kind: 'seek', atSec, toSec: 2 }] });
      let worst = 0;
      for (const [frame, value] of out.entries()) {
        const sourceFrame = frame < atSec * rate ? frame : frame - atSec * rate + 2 * rate;
        worst = Math.max(worst, Math.abs(value - ramp[sourceFrame]!));
      }
      return worst;
    }, { rate: RATE, atSec: GESTURE_SEC });
    expect(read).toBeLessThan(TOLERANCE);
  });

  it('take a new level from the moment it is set, the sound playing on', async () => {
    const read = await inPage(async ({ rate, atSec }) => {
      const { render, layer } = fixture();
      const loud = layer(new Array(2 * rate).fill(1), {}) as { source: Blob };
      const quieter = { ...loud, gain: 0.5 };
      const out = await render({ layers: [loud], renderSec: 1.5, gestures: [{ kind: 'layers', atSec, layers: [quieter] }] });
      return { before: out.slice(0, atSec * rate).every((value) => value === 1), after: out.slice(atSec * rate).every((value) => value === 0.5) };
    }, { rate: RATE, atSec: GESTURE_SEC });
    expect(read).toEqual({ before: true, after: true });
  });

  it('schedule nothing further ahead of the clock than the look-ahead', async () => {
    const read = await inPage(async ({ rate }) => {
      const { render, layer } = fixture();
      // The offline context renders far faster than the page wakes to schedule more, so only
      // what was scheduled before it started is heard: what lay within the look-ahead of 0.
      const out = await render({
        layers: [
          { ...(layer(new Array(rate / 10).fill(1), { outputStartSec: 0.5 }) as object), id: 'near' },
          { ...(layer(new Array(rate / 10).fill(1), { outputStartSec: 2.5 }) as object), id: 'far' },
        ],
        renderSec: 3,
        lookAheadSec: 1,
        settleMs: 100,
      });
      return { near: out[Math.round(0.55 * rate)], far: out[Math.round(2.55 * rate)] };
    }, { rate: RATE });
    expect(read).toEqual({ near: 1, far: 0 });
  });
});

async function inPage<Arg, Result>(body: (arg: Arg) => Promise<Result>, arg: Arg): Promise<Result> {
  const page: Page = await browser.newPage();
  try {
    await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>audio layers</title>' }));
    await page.goto('http://localhost/audio-layer-player');
    await page.addScriptTag({ content: `${bundle}\nwindow.fixture = () => audioLayerPlayerFixture;` });
    return await page.evaluate(body as (arg: unknown) => Promise<Result>, arg as unknown);
  } finally {
    await page.close();
  }
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'audio-layer-player-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const studio = resolve(import.meta.dirname, '../../../..');
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: {
      alias: {
        '@core': resolve(studio, 'core'),
        '@tscaps/engine/advanced': resolve(studio, '../../../packages/engine/src/advanced.ts'),
        '@tscaps/engine': resolve(studio, '../../../packages/engine/src/index.ts'),
        '@modules': resolve(studio, '../../../packages/engine/src/modules'),
      },
    },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'audioLayerPlayerFixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}
