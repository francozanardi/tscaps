import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * Whether an audio file plays is the browser's answer, so it is asked of
 * a real one: the probe the editor wires — mediabunny first, then Web
 * Audio — over real files.
 *
 * The fallback is load-bearing, not defensive: Safari decodes FLAC only
 * through `decodeAudioData`, its WebCodecs refusing it. That is
 * simulated here by deleting WebCodecs' `AudioDecoder` from the page,
 * which leaves mediabunny unable to decode FLAC while Web Audio still
 * can: the file must still be found playable, and mediabunny alone must
 * not find it so, or the case would prove nothing.
 *
 * The page is served on `http://localhost` through route interception
 * because WebCodecs only exists in secure contexts.
 */

const FIXTURE_ID = 'virtual:audio-playback-probe-fixture';
const FIXTURE_SOURCE = `
  export { FallbackAudioPlaybackProbe } from '@core/media/infrastructure/FallbackAudioPlaybackProbe';
  export { MediaBunnyAudioPlaybackProbe } from '@core/media/infrastructure/MediaBunnyAudioPlaybackProbe';
  export { WebAudioAudioPlaybackProbe } from '@core/media/infrastructure/WebAudioAudioPlaybackProbe';
`;

interface Fixture {
  readonly base64: string;
  readonly mimeType: string;
}

let browser: Browser;
let bundle: string;
let flac: Fixture;
let opus: Fixture;
const NOT_AUDIO: Fixture = { base64: Buffer.from('this is not a sound file at all').toString('base64'), mimeType: 'audio/mpeg' };

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
  flac = await fixture('tone-1s.flac', 'audio/flac');
  opus = await fixture('tone-1s.ogg', 'audio/ogg');
}, 120_000);

afterAll(async () => { await browser.close(); });

async function fixture(name: string, mimeType: string): Promise<Fixture> {
  const bytes = await readFile(resolve(import.meta.dirname, '../../_shared/fixtures', name));
  return { base64: bytes.toString('base64'), mimeType };
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'audio-playback-probe-fixture',
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

async function pageWithProbes(options: { withoutWebCodecsAudio: boolean }): Promise<Page> {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body></body></html>',
  }));
  await page.goto('http://localhost/audio-playback-probe-test');
  if (options.withoutWebCodecsAudio) {
    await page.evaluate(() => {
      delete (window as { AudioDecoder?: unknown }).AudioDecoder;
      delete (window as { AudioEncoder?: unknown }).AudioEncoder;
    });
  }
  await page.addScriptTag({ content: bundle });
  return page;
}

/** Asks `probe` — the wired one, or mediabunny alone — about `file` inside the page; resolves to `'plays'` or `'refused'`. */
async function ask(page: Page, file: Fixture, probe: 'wired' | 'mediabunny'): Promise<string> {
  return page.evaluate(async ({ base64, mimeType, probe }) => {
    interface Probe { ensurePlayable(audio: Blob): Promise<void> }
    const fixture = (window as never as {
      fixture: {
        FallbackAudioPlaybackProbe: new (primary: Probe, fallback: Probe) => Probe;
        MediaBunnyAudioPlaybackProbe: new () => Probe;
        WebAudioAudioPlaybackProbe: new () => Probe;
      };
    }).fixture;
    const mediabunny = new fixture.MediaBunnyAudioPlaybackProbe();
    const chosen = probe === 'wired'
      ? new fixture.FallbackAudioPlaybackProbe(mediabunny, new fixture.WebAudioAudioPlaybackProbe())
      : mediabunny;
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    try {
      await chosen.ensurePlayable(new Blob([bytes], { type: mimeType }));
      return 'plays';
    } catch {
      return 'refused';
    }
  }, { ...file, probe });
}

describe('whether an audio file plays in this browser', () => {
  it('finds an Ogg Opus file playable through WebCodecs', async () => {
    const page = await pageWithProbes({ withoutWebCodecsAudio: false });
    try {
      expect(await ask(page, opus, 'mediabunny')).toBe('plays');
      expect(await ask(page, opus, 'wired')).toBe('plays');
    } finally {
      await page.close();
    }
  });

  it('finds a FLAC file playable through Web Audio where WebCodecs cannot decode it', async () => {
    const page = await pageWithProbes({ withoutWebCodecsAudio: true });
    try {
      expect(await ask(page, flac, 'mediabunny')).toBe('refused');
      expect(await ask(page, flac, 'wired')).toBe('plays');
    } finally {
      await page.close();
    }
  });

  it('refuses a file no decoder reads', async () => {
    const page = await pageWithProbes({ withoutWebCodecsAudio: false });
    try {
      expect(await ask(page, NOT_AUDIO, 'wired')).toBe('refused');
    } finally {
      await page.close();
    }
  });
});
