import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * What the Web Audio decode path promises, asked of a real browser —
 * `OfflineAudioContext` only exists there.
 *
 * The subject is the fallback for runtimes whose WebCodecs cannot
 * decode audio, so the fixture is a plain H.264 + AAC video: the
 * decoder must return mono PCM at the requested rate spanning the
 * fixture's duration, and the fixture's 440 Hz tone must survive the
 * trip (a silent buffer of the right length would pass any purely
 * structural check).
 */

const FIXTURE_ID = 'virtual:web-audio-audio-decoder-fixture';
const FIXTURE_SOURCE = `
  export { WebAudioAudioDecoder } from '@modules/transcription/WebAudioAudioDecoder';
`;

interface PageDecoder {
  decode(audio: Blob, rate: number): Promise<Float32Array>;
}

interface PageFixture {
  WebAudioAudioDecoder: new (segmentSeconds?: number) => PageDecoder;
}

const TARGET_SAMPLE_RATE = 16000;
const FIXTURE_DURATION_SECONDS = 1;

let browser: Browser;
let bundle: string;
let fixtureBase64: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
  const bytes = await readFile(resolve(import.meta.dirname, '..', 'audio-decoding', 'fixtures', 'avc-aac-1s.mp4'));
  fixtureBase64 = bytes.toString('base64');
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'web-audio-audio-decoder-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '..') } },
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

async function pageWithDecoder(): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: bundle });
  return page;
}

interface DecodedSummary {
  readonly length: number;
  readonly rootMeanSquare: number;
}

const WINDOW_FRAMES = 400;
const SEGMENT_SECONDS = 0.25;
const SEGMENTS_IN_FIXTURE = FIXTURE_DURATION_SECONDS / SEGMENT_SECONDS;

/**
 * How loud the signal is in each consecutive window. A decode that
 * lost audio somewhere in the middle still reads loud on average, so
 * only a per-window look finds the hole.
 */
function windowRmsProfile(samples: readonly number[], windowFrames: number): number[] {
  const profile: number[] = [];
  for (let start = 0; start + windowFrames <= samples.length; start += windowFrames) {
    let sumOfSquares = 0;
    for (let index = start; index < start + windowFrames; index += 1) {
      sumOfSquares += samples[index]! * samples[index]!;
    }
    profile.push(Math.sqrt(sumOfSquares / windowFrames));
  }
  return profile;
}

/** The largest relative gap between two loudness profiles. */
function largestRelativeGap(reference: readonly number[], measured: readonly number[]): number {
  let largest = 0;
  for (let index = 0; index < Math.min(reference.length, measured.length); index += 1) {
    largest = Math.max(largest, Math.abs(measured[index]! - reference[index]!) / reference[index]!);
  }
  return largest;
}

describe('WebAudioAudioDecoder', () => {
  it('decodes a video with an AAC track to mono PCM at the requested rate, with the tone intact', async () => {
    const page = await pageWithDecoder();
    try {
      const summary = await page.evaluate<DecodedSummary, { base64: string; targetSampleRate: number }>(
        async ({ base64, targetSampleRate }) => {
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          const decoder = new (window as never as { fixture: PageFixture }).fixture.WebAudioAudioDecoder();
          const pcm = await decoder.decode(new Blob([bytes], { type: 'video/mp4' }), targetSampleRate);
          let sumOfSquares = 0;
          for (let index = 0; index < pcm.length; index += 1) sumOfSquares += pcm[index]! * pcm[index]!;
          return { length: pcm.length, rootMeanSquare: Math.sqrt(sumOfSquares / pcm.length) };
        },
        { base64: fixtureBase64, targetSampleRate: TARGET_SAMPLE_RATE },
      );
      const expectedFrames = TARGET_SAMPLE_RATE * FIXTURE_DURATION_SECONDS;
      expect(summary.length).toBeGreaterThan(expectedFrames * 0.9);
      expect(summary.length).toBeLessThan(expectedFrames * 1.1);
      // The fixture's tone lands around RMS 0.06; the assertion only
      // needs to tell real samples from silence, not pin the encoder's
      // exact loudness.
      expect(summary.rootMeanSquare).toBeGreaterThan(0.02);
    } finally {
      await page.close();
    }
  });

  /**
   * A source longer than one segment is decoded in several passes and
   * reassembled. The oracle is the same file decoded in one pass: the
   * split is an implementation detail of what the decode costs, so
   * the signal that comes out has to be the same one — and above all
   * must not thin out where two segments meet.
   *
   * The comparison is by loudness per window rather than sample by
   * sample. Every segment is resampled to the target rate on its own,
   * which lands its frames a fraction of a sample away from where a
   * single pass puts them; on a 440 Hz tone that sub-sample shift
   * alone reaches the amplitude of the signal, while saying nothing
   * about whether any audio was lost.
   */
  it('reassembles a segmented decode into the PCM a single-pass decode produces', async () => {
    const page = await pageWithDecoder();
    try {
      const { whole, segmented } = await page.evaluate<
        { whole: number[]; segmented: number[] },
        { base64: string; rate: number; segmentSeconds: number }
      >(
        async ({ base64, rate, segmentSeconds }) => {
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          const fixture = (window as never as { fixture: PageFixture }).fixture;
          const decodeWith = async (length: number): Promise<number[]> => {
            const decoder = new fixture.WebAudioAudioDecoder(length);
            const pcm = await decoder.decode(new Blob([bytes], { type: 'video/mp4' }), rate);
            return Array.from(pcm);
          };
          return { whole: await decodeWith(Infinity), segmented: await decodeWith(segmentSeconds) };
        },
        { base64: fixtureBase64, rate: TARGET_SAMPLE_RATE, segmentSeconds: SEGMENT_SECONDS },
      );

      // Each segment resamples on its own, so each may land a frame
      // off; what must not happen is a segment's worth going missing.
      expect(Math.abs(segmented.length - whole.length)).toBeLessThanOrEqual(SEGMENTS_IN_FIXTURE);
      // Measured on this fixture: 2% once every segment carries the
      // context its codec reconstructs from, 38% without it — the
      // window around each seam decoding at a fraction of its level.
      expect(largestRelativeGap(
        windowRmsProfile(whole, WINDOW_FRAMES),
        windowRmsProfile(segmented, WINDOW_FRAMES),
      )).toBeLessThan(0.15);
    } finally {
      await page.close();
    }
  });

  it('rejects undecodable bytes with the NotSupportedError callers classify on', async () => {
    const page = await pageWithDecoder();
    try {
      const errorName = await page.evaluate<string>(async () => {
        const bytes = new Uint8Array(256).fill(7);
        const decoder = new (window as never as { fixture: PageFixture }).fixture.WebAudioAudioDecoder();
        try {
          await decoder.decode(new Blob([bytes]), 16000);
          return 'resolved';
        } catch (err) {
          return err instanceof Error ? err.name : 'unknown';
        }
      });
      expect(errorName).toBe('NotSupportedError');
    } finally {
      await page.close();
    }
  });
});
