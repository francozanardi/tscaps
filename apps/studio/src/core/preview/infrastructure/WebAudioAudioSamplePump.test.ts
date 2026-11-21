import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * Whether the video's own sound keeps playing in the preview when its
 * decoding falls behind the clock, asked of a real browser: what the
 * pump schedules is recorded off a running `AudioContext`, the way it
 * reaches the speakers.
 *
 * The track is an in-memory implementation of the port that decodes a
 * steady tone at a chosen speed, starts late by a chosen delay, and can
 * stall for a while partway, the way decoding does on a phone when the
 * main thread is busy drawing a graphic. Only a little faster than real
 * time, so a pump that decodes every late frame it skipped takes
 * seconds to be heard again.
 */

const FIXTURE_ID = 'virtual:audio-sample-pump-fixture';
const FIXTURE_SOURCE = `
  export { WebAudioAudioSamplePump } from '@core/preview/infrastructure/WebAudioAudioSamplePump';
  export { AudioContextPlaybackClock } from '@core/preview/infrastructure/AudioContextPlaybackClock';
  export { RenderTimeMap } from '@modules/video/RenderTimeMap';
`;

/** How the in-page track decodes. */
interface TrackSpec {
  /** How long the first frame of every stream takes to come out. */
  readonly firstFrameDelayMs: number;
  /** How many seconds of audio it decodes per second. */
  readonly speed: number;
  /** A pause in decoding, from this many ms into playback, this long. */
  readonly stall?: { readonly atMs: number; readonly forMs: number };
}

/** What was heard, on the audio clock, in seconds from the play gesture. */
interface Heard {
  /** When sound was first heard. */
  readonly firstSoundSec: number | null;
  /** When sound was first heard once the stall ended; null without a stall, or when it never came back. */
  readonly firstSoundAfterStallSec: number | null;
  /** The longest silence once sound was first heard. */
  readonly longestSilenceSec: number;
}

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  bundle = await bundleForThePage();
}, 120_000);

afterAll(async () => { await browser.close(); });

describe('the video\'s own sound in the preview', () => {
  it('is heard soon after playing starts, though its first frame decodes late', async () => {
    const heard = await play({ firstFrameDelayMs: 250, speed: 1.15 }, 3);
    expect(heard.firstSoundSec).not.toBeNull();
    expect(heard.firstSoundSec!).toBeLessThan(0.9);
    expect(heard.longestSilenceSec).toBeLessThan(0.1);
  }, 30_000);

  it('comes back soon after its decoding stalls partway', async () => {
    const stall = { atMs: 1_000, forMs: 1_500 };
    const heard = await play({ firstFrameDelayMs: 20, speed: 1.15, stall }, 5);
    // Silence while nothing decodes cannot be helped; what follows it can.
    expect(heard.firstSoundAfterStallSec).not.toBeNull();
    expect(heard.firstSoundAfterStallSec! - (stall.atMs + stall.forMs) / 1000).toBeLessThan(0.4);
  }, 30_000);
});

/** Plays a track decoding as `spec` says for `seconds`, and answers what was heard. */
async function play(spec: TrackSpec, seconds: number): Promise<Heard> {
  const page = await pageWithPump();
  try {
    return await page.evaluate(async ({ spec, seconds }) => {
      const { WebAudioAudioSamplePump, AudioContextPlaybackClock, RenderTimeMap } = (window as unknown as { audioSamplePumpFixture: PageFixture }).audioSamplePumpFixture;
      const context = new AudioContext();
      await context.resume();
      const rate = context.sampleRate;
      const frameLength = 1024;
      const startedAt = performance.now();
      const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
      const track = {
        async *streamFrames(startSourceSec: number) {
          await sleep(spec.firstFrameDelayMs);
          const frameSec = frameLength / rate;
          let sourceSec = startSourceSec;
          let nextDueMs = performance.now();
          for (;;) {
            const stall = spec.stall;
            const elapsedMs = performance.now() - startedAt;
            if (stall && elapsedMs >= stall.atMs && elapsedMs < stall.atMs + stall.forMs) {
              await sleep(stall.atMs + stall.forMs - elapsedMs);
            }
            // Never faster than its speed, a stall included: a decoder does not make up lost time.
            nextDueMs = Math.max(nextDueMs, performance.now()) + (frameSec / spec.speed) * 1000;
            await sleep(nextDueMs - performance.now());
            const timestampSec = sourceSec;
            yield {
              timestampSec,
              toAudioBuffer: () => {
                const buffer = new AudioBuffer({ length: frameLength, sampleRate: rate, numberOfChannels: 1 });
                buffer.getChannelData(0).fill(0.5);
                return buffer;
              },
              close: () => {},
            };
            sourceSec += frameSec;
          }
        },
      };
      const recorder = context.createScriptProcessor(1024, 1, 1);
      const blocks: Array<{ atSec: number; loud: boolean }> = [];
      recorder.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        let loudest = 0;
        for (const value of data) loudest = Math.max(loudest, Math.abs(value));
        blocks.push({ atSec: event.playbackTime, loud: loudest > 0.25 });
      };
      const sink = context.createGain();
      sink.gain.value = 0;
      recorder.connect(sink);
      sink.connect(context.destination);
      const clock = new AudioContextPlaybackClock(context);
      const pump = new WebAudioAudioSamplePump(track, context, recorder, clock, () => new RenderTimeMap([]));
      const playedAtSec = context.currentTime;
      clock.play(0);
      pump.startFromOutputTime(0);
      await sleep(seconds * 1000);
      pump.cancel();
      recorder.disconnect();
      await context.close();

      const heardBlocks = blocks.filter((block) => block.atSec >= playedAtSec && block.atSec < playedAtSec + seconds - 0.3);
      const first = heardBlocks.find((block) => block.loud);
      let longestSilenceSec = 0;
      let silentSince: number | null = null;
      for (const block of heardBlocks) {
        if (first === undefined || block.atSec < first.atSec) continue;
        if (block.loud) {
          if (silentSince !== null) longestSilenceSec = Math.max(longestSilenceSec, block.atSec - silentSince);
          silentSince = null;
        } else if (silentSince === null) {
          silentSince = block.atSec;
        }
      }
      const endSec = playedAtSec + seconds - 0.3;
      if (silentSince !== null) longestSilenceSec = Math.max(longestSilenceSec, endSec - silentSince);
      const stallEndSec = spec.stall ? playedAtSec + (spec.stall.atMs + spec.stall.forMs) / 1000 : null;
      const afterStall = stallEndSec === null ? undefined : heardBlocks.find((block) => block.loud && block.atSec >= stallEndSec);
      return {
        firstSoundSec: first ? first.atSec - playedAtSec : null,
        firstSoundAfterStallSec: afterStall ? afterStall.atSec - playedAtSec : null,
        longestSilenceSec,
      };
    }, { spec, seconds });
  } finally {
    await page.close();
  }
}

interface PageFixture {
  WebAudioAudioSamplePump: typeof import('@core/preview/infrastructure/WebAudioAudioSamplePump').WebAudioAudioSamplePump;
  AudioContextPlaybackClock: typeof import('@core/preview/infrastructure/AudioContextPlaybackClock').AudioContextPlaybackClock;
  RenderTimeMap: typeof import('@modules/video/RenderTimeMap').RenderTimeMap;
}

async function pageWithPump(): Promise<Page> {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('http://localhost/audio-sample-pump-test');
  await page.addScriptTag({ content: bundle });
  return page;
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'audio-sample-pump-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: {
      alias: {
        '@core': resolve(import.meta.dirname, '../..'),
        '@modules': resolve(import.meta.dirname, '../../../../../../packages/engine/src/modules'),
      },
    },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'audioSamplePumpFixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}
