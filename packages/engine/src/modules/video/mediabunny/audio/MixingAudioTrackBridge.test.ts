import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That an export with audio layers writes them where and how loud they
 * were asked for, read back from the encoded file by a demuxer and a
 * decoder rather than from the mixer's own bookkeeping.
 *
 * Most renders force uncompressed PCM as the mix codec, so a sample can
 * be compared with the sample it should be; the codec choice itself is
 * covered separately, through the selector an export uses.
 */

const FIXTURE_ID = 'virtual:audio-mix-render-fixture';
const FIXTURE_SOURCE = `
  import { AudioMixRenderFixture } from '@modules/video/mediabunny/audio/AudioMixRenderFixture.fixture';
  export const renders = new AudioMixRenderFixture();
  export { AudioGainEnvelope } from '@modules/video/AudioGainEnvelope';
  export { RenderTimeMap } from '@modules/video/RenderTimeMap';
  export { CustomAudioEncoder, EncodedPacket, registerEncoder } from 'mediabunny';
`;

const RATE = 48_000;
/** The long render: five minutes, as the design asks, at a common frame rate; about ten seconds in the pinned Chromium. */
const LONG_RENDER_SEC = 300;
const LONG_RENDER_FPS = 30;

let browser: Browser;
let bundle: string;
let aacSource: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
  aacSource = (await readFile(resolve(import.meta.dirname, '..', '..', '..', 'audio-decoding', 'fixtures', 'avc-aac-1s.mp4'))).toString('base64');
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('an export with audio layers', () => {
  it('places a layer to the sample on output time, ringing on across a cut', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const ramp = new Float32Array(rate).map((_, index) => (index + 1) / 100_000);
      const source = await renders.sourceVideo({ durationSec: 3, fps: 10 });
      const result = await renders.render({
        source,
        skipRanges: [{ startSec: 1, endSec: 1.5 }],
        mixCodec: 'pcm-f32',
        mix: { inputGain: 1, layers: [layerOf(renders.wav([ramp], rate), { outputStartSec: 0.7 })] },
      });
      const audio = (await renders.audioOf(result.blob!))!;
      const startFrame = 0.7 * rate;
      let mismatches = 0;
      for (const channel of audio.channels) {
        for (const [frame, value] of channel.entries()) {
          const expected = frame >= startFrame && frame < startFrame + rate ? ramp[frame - startFrame]! : 0;
          if (value !== expected) mismatches++;
        }
      }
      return { codec: audio.codec, sampleRate: audio.sampleRate, channels: audio.numberOfChannels, frames: audio.channels[0]!.length, mismatches };

      function layerOf(blob: Blob, overrides: Record<string, unknown>) {
        return {
          id: 'ramp', source: blob, outputStartSec: 0, outputEndSec: Infinity, sourceStartSec: 0,
          sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null, ...overrides,
        };
      }
    }, { rate: RATE });
    expect(read).toEqual({ codec: 'pcm-f32', sampleRate: RATE, channels: 2, frames: 2.5 * RATE, mismatches: 0 });
  });

  it('lays the input audio on output time, each cut trimmed to the sample and faded over 5 ms at both edges', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const inputAudio = new Float32Array(3 * rate).map((_, index) => 0.1 + index / 1_000_000);
      const source = await renders.sourceVideo({ durationSec: 3, fps: 10, audio: { sampleRate: rate, channels: [inputAudio], codec: 'pcm-f32' } });
      const silent = renders.wav([new Float32Array(100)], rate);
      const result = await renders.render({
        source,
        skipRanges: [{ startSec: 1, endSec: 1.5 }],
        mixCodec: 'pcm-f32',
        mix: { inputGain: 0.5, layers: [{
          id: 'silent', source: silent, outputStartSec: 0, outputEndSec: Infinity, sourceStartSec: 0,
          sourcePassSec: Infinity, gain: 0, fadeInSec: 0, fadeOutSec: 0, duck: null,
        }] },
      });
      const audio = (await renders.audioOf(result.blob!))!;
      let worst = 0;
      for (const [frame, value] of audio.channels[0]!.entries()) {
        const sourceFrame = frame < rate ? frame : frame + rate / 2;
        const sourceSec = sourceFrame / rate;
        const level = Math.min(1, Math.max(0, sourceSec < 1 ? (1 - sourceSec) / 0.005 : (sourceSec - 1.5) / 0.005));
        worst = Math.max(worst, Math.abs(value - 0.5 * inputAudio[sourceFrame]! * level));
      }
      const around = Array.from(audio.channels[0]!.subarray(rate - 2, rate + 2));
      return { channels: audio.numberOfChannels, frames: audio.channels[0]!.length, worst, around };
    }, { rate: RATE });
    expect(read.channels).toBe(1);
    expect(read.frames).toBe(2.5 * RATE);
    expect(read.worst).toBeLessThan(1e-7);
    for (const value of read.around) expect(Math.abs(value)).toBeLessThan(0.001);
  });

  it('applies the same gain curve the envelope answers, through fades and a duck', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders, AudioGainEnvelope } = fixture();
      const constant = new Float32Array(2 * rate).fill(1);
      const layer = {
        id: 'bed', source: renders.wav([constant], rate), outputStartSec: 0.5, outputEndSec: 2.3, sourceStartSec: 0,
        sourcePassSec: Infinity, gain: 0.8, fadeInSec: 0.2, fadeOutSec: 0.3,
        duck: { ranges: [{ startSec: 1, endSec: 1.2 }], gain: 0.25, attackSec: 0.1, releaseSec: 0.15 },
      };
      const source = await renders.sourceVideo({ durationSec: 3, fps: 10 });
      const result = await renders.render({ source, mixCodec: 'pcm-f32', mix: { inputGain: 1, layers: [layer] } });
      const audio = (await renders.audioOf(result.blob!))!;
      const envelope = new AudioGainEnvelope(layer, { outputDurationSec: 3, sourceDurationSec: 2 });
      let worst = 0;
      for (const [frame, value] of audio.channels[0]!.entries()) {
        worst = Math.max(worst, Math.abs(value - envelope.gainAt(frame / rate)));
      }
      const at = (sec: number) => audio.channels[0]![Math.round(sec * rate)]!;
      return { worst, ducked: at(1.1), fadedIn: at(0.6), beforeDuck: at(0.85) };
    }, { rate: RATE });
    expect(read.worst).toBeLessThan(1e-6);
    expect(read.ducked).toBeCloseTo(0.2, 6);
    expect(read.fadedIn).toBeCloseTo(0.4, 6);
    expect(read.beforeDuck).toBeCloseTo(0.8, 6);
  });

  it('starts a layer over every pass, silent for the part of a pass past its source', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const ramp = new Float32Array(rate / 4).map((_, index) => (index + 1) / 100_000);
      const source = await renders.sourceVideo({ durationSec: 2, fps: 10 });
      const result = await renders.render({
        source,
        mixCodec: 'pcm-f32',
        mix: { inputGain: 1, layers: [{
          id: 'loop', source: renders.wav([ramp], rate), outputStartSec: 0.2, outputEndSec: 1.9,
          sourceStartSec: 0.05, sourcePassSec: 0.3, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
        }] },
      });
      const audio = (await renders.audioOf(result.blob!))!;
      const [start, end, offset, pass] = [0.2 * rate, 1.9 * rate, 0.05 * rate, 0.3 * rate];
      let mismatches = 0;
      for (const [frame, value] of audio.channels[0]!.entries()) {
        const intoPass = (frame - start) % pass;
        const inside = frame >= start && frame < end && offset + intoPass < ramp.length;
        if (value !== (inside ? ramp[offset + intoPass]! : 0)) mismatches++;
      }
      return { mismatches, passStarts: [start, start + pass, start + 2 * pass].map((frame) => audio.channels[0]![frame]) };
    }, { rate: RATE });
    expect(read.mismatches).toBe(0);
    expect(read.passStarts).toEqual([Math.fround(2401 / 100_000), Math.fround(2401 / 100_000), Math.fround(2401 / 100_000)]);
  });

  it('runs on without a step where one written window meets the next', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      // Quiet enough that the sum never reaches full scale, where it would be clipped.
      const tone = (hz: number) => new Float32Array(5 * rate).map((_, index) => 0.4 * Math.sin((2 * Math.PI * hz * index) / rate));
      const inputAudio = tone(300);
      const layerTone = tone(440);
      const source = await renders.sourceVideo({ durationSec: 5, fps: 10, audio: { sampleRate: rate, channels: [inputAudio], codec: 'pcm-f32' } });
      const result = await renders.render({
        source,
        mixCodec: 'pcm-f32',
        mix: { inputGain: 1, layers: [{
          id: 'tone', source: renders.wav([layerTone], rate), outputStartSec: 0, outputEndSec: Infinity, sourceStartSec: 0,
          sourcePassSec: Infinity, gain: 0.5, fadeInSec: 0, fadeOutSec: 0, duck: null,
        }] },
      });
      const out = (await renders.audioOf(result.blob!))!.channels[0]!;
      let worst = 0;
      let largestStep = 0;
      for (const [frame, value] of out.entries()) {
        worst = Math.max(worst, Math.abs(value - Math.fround(inputAudio[frame]! + layerTone[frame]! * 0.5)));
        if (frame > 0) largestStep = Math.max(largestStep, Math.abs(value - out[frame - 1]!));
      }
      const seamSteps = [2 * rate, 4 * rate].map((frame) => Math.abs(out[frame]! - out[frame - 1]!));
      return { frames: out.length, worst, largestStep, seamSteps };
    }, { rate: RATE });
    expect(read.frames).toBe(5 * RATE);
    expect(read.worst).toBe(0);
    for (const step of read.seamSteps) expect(step).toBeLessThanOrEqual(read.largestStep);
  });

  it(`keeps audio and video in step to the sample over a ${LONG_RENDER_SEC / 60}-minute render with cuts`, async () => {
    const read = await inPage(async ({ rate, durationSec, fps }) => {
      const { renders, RenderTimeMap } = fixture();
      const cuts = [{ startSec: 30, endSec: 32.5 }, { startSec: 100.2, endSec: 101 }, { startSec: 200, endSec: 215 }];
      const timeMap = new RenderTimeMap(cuts);
      const inputAudio = new Float32Array(durationSec * rate);
      const inputClicks: number[] = [];
      for (let sec = 5.123; sec < durationSec; sec += 10) {
        if (timeMap.isSkipped(sec)) continue;
        inputAudio[Math.round(sec * rate)] = 0.5;
        inputClicks.push(Math.round(timeMap.toOutputTime(Math.round(sec * rate) / rate) * rate));
      }
      const click = new Float32Array(rate / 10);
      click[0] = 0.25;
      const source = await renders.sourceVideo({ durationSec, fps, audio: { sampleRate: rate, channels: [inputAudio], codec: 'pcm-s16' } });
      const result = await renders.render({
        source,
        skipRanges: cuts,
        mixCodec: 'pcm-s16',
        mix: { inputGain: 1, layers: [{
          id: 'click', source: renders.wav([click], rate), outputStartSec: 3, outputEndSec: Infinity, sourceStartSec: 0,
          sourcePassSec: 7, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
        }] },
      });
      const audio = (await renders.audioOf(result.blob!))!;
      const out = audio.channels[0]!;
      const found = { inputAudio: [] as number[], layer: [] as number[] };
      for (const [frame, value] of out.entries()) {
        if (Math.abs(value - 0.5) < 1e-3) found.inputAudio.push(frame);
        else if (Math.abs(value - 0.25) < 1e-3) found.layer.push(frame);
      }
      const layerClicks: number[] = [];
      for (let sec = 3; sec * rate < out.length; sec += 7) layerClicks.push(Math.round(sec * rate));
      const drift = (actual: number[], expected: number[]) =>
        actual.length === expected.length ? Math.max(...actual.map((frame, index) => Math.abs(frame - expected[index]!))) : Infinity;
      return {
        inputDrift: drift(found.inputAudio, inputClicks),
        layerDrift: drift(found.layer, layerClicks),
        inputClicks: inputClicks.length,
        audioSec: out.length / rate,
        videoSec: await renders.videoDurationOf(result.blob!),
        expectedSec: durationSec - timeMap.totalSkipDuration(),
      };
    }, { rate: RATE, durationSec: LONG_RENDER_SEC, fps: LONG_RENDER_FPS });
    expect(read.inputClicks).toBeGreaterThan(20);
    expect(read.inputDrift).toBe(0);
    expect(read.layerDrift).toBe(0);
    expect(Math.abs(read.audioSec - read.expectedSec)).toBeLessThan(1 / RATE);
    expect(Math.abs(read.audioSec - read.videoSec)).toBeLessThan(1 / LONG_RENDER_FPS);
  }, 300_000);
});

describe('an export without audio layers', () => {
  it('copies the input audio packets exactly as when no mix is given, while the input stays at its own level', async () => {
    const read = await inPage(async ({ aac }) => {
      const { renders } = fixture();
      const source = new Blob([Uint8Array.from(atob(aac), (char) => char.charCodeAt(0))]);
      const without = await renders.render({ source });
      const empty = await renders.render({ source, mix: { inputGain: 1, layers: [] } });
      return {
        withoutMix: await renders.audioPacketsOf(without.blob!),
        emptyMix: await renders.audioPacketsOf(empty.blob!),
        codec: (await renders.audioOf(empty.blob!))?.codec ?? null,
      };
    }, { aac: aacSource });
    expect(read.withoutMix).not.toBeNull();
    expect(read.emptyMix).toBe(read.withoutMix);
    expect(read.codec).toBe('aac');
  });

  it('scales the input audio by the input gain, laid on output time like a mix with layers', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const inputAudio = new Float32Array(3 * rate).map((_, index) => 0.1 + index / 1_000_000);
      const source = await renders.sourceVideo({ durationSec: 3, fps: 10, audio: { sampleRate: rate, channels: [inputAudio], codec: 'pcm-f32' } });
      const louder = await renders.render({ source, mixCodec: 'pcm-f32', skipRanges: [{ startSec: 1, endSec: 1.5 }], mix: { inputGain: 1.5, layers: [] } });
      const audio = (await renders.audioOf(louder.blob!))!;
      // Away from the cut's 5 ms fades, every frame is the input's, one and a half times as loud.
      let worst = 0;
      for (const [frame, value] of audio.channels[0]!.entries()) {
        if (Math.abs(frame - rate) < 0.01 * rate) continue;
        const sourceFrame = frame < rate ? frame : frame + rate / 2;
        worst = Math.max(worst, Math.abs(value - 1.5 * inputAudio[sourceFrame]!));
      }
      return { codec: audio.codec, frames: audio.channels[0]!.length, worst };
    }, { rate: RATE });
    expect(read.codec).toBe('pcm-f32');
    expect(read.frames).toBe(2.5 * RATE);
    expect(read.worst).toBeLessThan(1e-6);
  });

  it('shapes the input audio over the input ducks\' ranges, on output time, and only there', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const inputAudio = new Float32Array(3 * rate).fill(0.2);
      const source = await renders.sourceVideo({ durationSec: 3, fps: 10, audio: { sampleRate: rate, channels: [inputAudio], codec: 'pcm-f32' } });
      // The cut takes 0.5 s out before the range, so the range's output time is not its source time.
      const result = await renders.render({
        source,
        mixCodec: 'pcm-f32',
        skipRanges: [{ startSec: 0.25, endSec: 0.75 }],
        mix: { inputGain: 1, layers: [], inputDucks: [
          { ranges: [{ startSec: 1, endSec: 2 }], gain: 0, attackSec: 0.1, releaseSec: 0.1 },
          { ranges: [{ startSec: 2.2, endSec: 2.5 }], gain: 2, attackSec: 0.01, releaseSec: 0.01 },
        ] },
      });
      const channel = (await renders.audioOf(result.blob!))!.channels[0]!;
      const at = (sec: number) => channel[Math.round(sec * rate)]!;
      return { frames: channel.length, before: at(0.5), rampDown: at(0.95), muted: at(1.5), rampUp: at(2.05), raised: at(2.3), after: at(2.15) };
    }, { rate: RATE });
    expect(read.frames).toBe(2.5 * RATE);
    expect(read.before).toBeCloseTo(0.2, 6);
    expect(read.rampDown).toBeCloseTo(0.1, 3);
    expect(read.muted).toBe(0);
    expect(read.rampUp).toBeCloseTo(0.1, 3);
    expect(read.after).toBeCloseTo(0.2, 6);
    expect(read.raised).toBeCloseTo(0.4, 6);
  });

  it('writes no audio for a level change when there is no input audio to change, or it is discarded', async () => {
    const read = await inPage(async ({ aac }) => {
      const { renders } = fixture();
      const silentSource = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const withAudio = new Blob([Uint8Array.from(atob(aac), (char) => char.charCodeAt(0))]);
      const mix = { inputGain: 0.5, layers: [] };
      const noInputAudio = await renders.render({ source: silentSource, mixCodec: 'pcm-f32', mix });
      const discarded = await renders.render({ source: withAudio, mixCodec: 'pcm-f32', audio: 'discard', mix });
      return {
        noInputAudio: await renders.audioOf(noInputAudio.blob!),
        discarded: await renders.audioOf(discarded.blob!),
        dropped: [...noInputAudio.mixDropped, ...discarded.mixDropped],
      };
    }, { aac: aacSource });
    expect(read).toEqual({ noInputAudio: null, discarded: null, dropped: [] });
  });
});

describe('the input audio of a mix', () => {
  /**
   * Some browsers say WebCodecs decodes the input's codec and then fail
   * on its first packet, or partway; the fixture makes the page's real
   * decoder fail the same way. The oracle is the same render where
   * WebCodecs works, compared by loudness per window: the Web Audio
   * path decodes the same signal, but not to the same sample, so a
   * per-sample comparison of a tone says nothing about whether audio
   * was lost. The first window is left out of the comparison: there the
   * Web Audio API itself starts the track softer, decoded whole or in
   * segments alike (27% on this fixture), while every window after it,
   * across the segment seams, agrees to 0.1%.
   */
  for (const decoding of ['webcodecs-fails', 'webcodecs-fails-partway'] as const) {
    it(`goes on through Web Audio where WebCodecs fails on it (${decoding}), as loud as WebCodecs mixes it`, async () => {
      const read = await inPage(async ({ aac, rate, decoding }) => {
        const { renders } = fixture();
        const source = new Blob([Uint8Array.from(atob(aac), (char) => char.charCodeAt(0))]);
        const mix = { inputGain: 1, layers: [{
          id: 'silent', source: renders.wav([new Float32Array(100)], rate), outputStartSec: 0, outputEndSec: Infinity,
          sourceStartSec: 0, sourcePassSec: Infinity, gain: 0, fadeInSec: 0, fadeOutSec: 0, duck: null,
        }] };
        const reference = (await renders.audioOf((await renders.render({ source, mix, mixCodec: 'pcm-f32' })).blob!))!.channels[0]!;
        const fellBack = await renders.render({ source, mix, mixCodec: 'pcm-f32', inputAudioDecoding: decoding });
        const decoded = (await renders.audioOf(fellBack.blob!))!.channels[0]!;
        const windowFrames = reference.length / 20;
        const loudness = (channel: Float32Array, from: number) => {
          let sumOfSquares = 0;
          for (let frame = from; frame < from + windowFrames; frame++) sumOfSquares += channel[frame]! * channel[frame]!;
          return Math.sqrt(sumOfSquares / windowFrames);
        };
        let largestGap = 0;
        let quietest = Infinity;
        for (let from = windowFrames; from + windowFrames <= reference.length; from += windowFrames) {
          largestGap = Math.max(largestGap, Math.abs(loudness(decoded, from) - loudness(reference, from)) / loudness(reference, from));
          quietest = Math.min(quietest, loudness(decoded, from));
        }
        return {
          errorName: fellBack.errorName,
          mixDropped: fellBack.mixDropped,
          fallbacks: fellBack.inputAudioFallbacks,
          sameLength: decoded.length === reference.length,
          largestGap,
          quietest,
        };
      }, { aac: aacSource, rate: RATE, decoding });
      expect(read).toMatchObject({ errorName: null, mixDropped: [], fallbacks: ['EncodingError'], sameLength: true });
      // The fixture's tone sits around RMS 0.06; silence would pass the gap check against nothing.
      expect(read.quietest).toBeGreaterThan(0.05);
      expect(read.largestGap).toBeLessThan(0.01);
    });
  }

  it('is dropped with the sounds, the input audio written as without a mix, where no decoder can read it', async () => {
    const read = await inPage(async ({ aac, rate }) => {
      const { renders } = fixture();
      const source = new Blob([Uint8Array.from(atob(aac), (char) => char.charCodeAt(0))]);
      const without = await renders.render({ source });
      const mixed = await renders.render({ source, inputAudioDecoding: 'all-fail', mix: { inputGain: 1, layers: [{
        id: 'tone', source: renders.wav([new Float32Array(rate / 2).fill(0.2)], rate), outputStartSec: 0, outputEndSec: Infinity,
        sourceStartSec: 0, sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      }] } });
      return {
        errorName: mixed.errorName,
        mixDropped: mixed.mixDropped,
        keepsInput: mixed.blob !== null && (await renders.audioPacketsOf(mixed.blob)) === (await renders.audioPacketsOf(without.blob!)),
      };
    }, { aac: aacSource, rate: RATE });
    expect(read).toEqual({ errorName: null, mixDropped: ['undecodable-input-audio'], keepsInput: true });
  });
});

describe('the sources of audio layers', () => {
  it('fall back to Web Audio when the first decoder fails, with the same result', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const sting = renders.wav([new Float32Array(rate / 2).map((_, index) => Math.sin(index / 7) * 0.3)], rate);
      const source = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const mix = { inputGain: 1, layers: [{
        id: 'sting', source: sting, outputStartSec: 0.1, outputEndSec: Infinity, sourceStartSec: 0,
        sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      }] };
      const primary = (await renders.audioOf((await renders.render({ source, mix, mixCodec: 'pcm-f32' })).blob!))!.channels[0]!;
      const fallback = (await renders.audioOf((await renders.render({ source, mix, mixCodec: 'pcm-f32', layerDecoding: 'primary-fails' })).blob!))!.channels[0]!;
      let worst = 0;
      let loudest = 0;
      for (const [frame, value] of primary.entries()) {
        worst = Math.max(worst, Math.abs(value - fallback[frame]!));
        loudest = Math.max(loudest, Math.abs(fallback[frame]!));
      }
      return { worst, loudest };
    }, { rate: RATE });
    expect(read.loudest).toBeGreaterThan(0.25);
    expect(read.worst).toBeLessThan(1e-6);
  });

  it('reject the run, naming the layer, when no decoder can read one', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const source = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const result = await renders.render({
        source,
        mixCodec: 'pcm-f32',
        layerDecoding: 'all-fail',
        mix: { inputGain: 1, layers: [{
          id: 'sting', source: renders.wav([new Float32Array(100)], rate), outputStartSec: 0, outputEndSec: Infinity,
          sourceStartSec: 0, sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
        }] },
      });
      return { errorName: result.errorName, failedLayerId: result.failedLayerId };
    }, { rate: RATE });
    expect(read).toEqual({ errorName: 'AudioLayerDecodeFailedError', failedLayerId: 'sting' });
  });

  it('go on without the layers no decoder can read, once asked and agreed, before anything is written', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const source = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const layer = (id: string) => ({
        id, source: renders.wav([new Float32Array(100)], rate), outputStartSec: 0, outputEndSec: Infinity,
        sourceStartSec: 0, sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      });
      const agreed = await renders.render({
        source, mixCodec: 'pcm-f32', layerDecoding: 'all-fail', undecodableLayers: 'go-on',
        mix: { inputGain: 1, layers: [layer('sting'), layer('swoosh')] },
      });
      const refused = await renders.render({
        source, mixCodec: 'pcm-f32', layerDecoding: 'all-fail', undecodableLayers: 'stop',
        mix: { inputGain: 1, layers: [layer('sting')] },
      });
      return {
        agreed: { written: agreed.blob !== null, asked: agreed.askedToGoOnWithout },
        refused: { errorName: refused.errorName, failedLayerId: refused.failedLayerId },
      };
    }, { rate: RATE });
    expect(read.agreed).toEqual({ written: true, asked: ['sting', 'swoosh'] });
    expect(read.refused).toEqual({ errorName: 'AudioLayerDecodeFailedError', failedLayerId: 'sting' });
  });

  it('are decoded once per file, however many layers use it', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const shared = renders.wav([new Float32Array(rate / 10).fill(0.1)], rate);
      const other = renders.wav([new Float32Array(rate / 10).fill(0.1)], rate);
      const layer = (id: string, source: Blob, outputStartSec: number) => ({
        id, source, outputStartSec, outputEndSec: Infinity, sourceStartSec: 0,
        sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      });
      const source = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const result = await renders.render({
        source,
        mixCodec: 'pcm-f32',
        mix: { inputGain: 1, layers: [layer('a', shared, 0), layer('b', other, 0.2), layer('c', shared, 0.5)] },
      });
      return result.decodesPerSource;
    }, { rate: RATE });
    expect(read).toEqual([1, 1]);
  });
});

describe('the codec of a mix', () => {
  it('is Opus where AAC cannot be encoded, in MP4 and in WebM, and the output gains a track at 48 kHz stereo', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders } = fixture();
      const source = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const mix = { inputGain: 1, layers: [{
        id: 'tone', source: renders.wav([new Float32Array(rate / 2).fill(0.2)], rate), outputStartSec: 0, outputEndSec: Infinity,
        sourceStartSec: 0, sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      }] };
      const shapes = [];
      for (const outputFormat of ['mp4', 'webm'] as const) {
        const audio = (await renders.audioOf((await renders.render({ source, mix, outputFormat })).blob!))!;
        shapes.push({ codec: audio.codec, sampleRate: audio.sampleRate, channels: audio.numberOfChannels });
      }
      return shapes;
    }, { rate: RATE });
    expect(read).toEqual([
      { codec: 'opus', sampleRate: RATE, channels: 2 },
      { codec: 'opus', sampleRate: RATE, channels: 2 },
    ]);
  });

  it('is AAC first when an encoder for it is registered', async () => {
    const read = await inPage(async ({ rate }) => {
      const { renders, CustomAudioEncoder, EncodedPacket, registerEncoder } = fixture();
      // Writes packets nobody will decode; only the codec the output declares is read back.
      class FakeAacEncoder extends CustomAudioEncoder {
        static override supports(codec: string) { return codec === 'aac'; }
        init() {}
        encode(sample: { timestamp: number; numberOfFrames: number; sampleRate: number }) {
          const packet = new EncodedPacket(new Uint8Array([0x21, 0x10]), 'key', sample.timestamp, sample.numberOfFrames / sample.sampleRate);
          this.onPacket(packet, { decoderConfig: { codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 2, description: new Uint8Array([0x11, 0x90]) } });
        }
        flush() {}
        close() {}
      }
      registerEncoder(FakeAacEncoder);
      const source = await renders.sourceVideo({ durationSec: 1, fps: 10 });
      const result = await renders.render({ source, mix: { inputGain: 1, layers: [{
        id: 'tone', source: renders.wav([new Float32Array(rate / 2).fill(0.2)], rate), outputStartSec: 0, outputEndSec: Infinity,
        sourceStartSec: 0, sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      }] } });
      return renders.audioCodecOf(result.blob!);
    }, { rate: RATE });
    expect(read).toBe('aac');
  });

  it('when none can be encoded, is reported dropped and the input audio is written as without a mix', async () => {
    const read = await inPage(async ({ aac, rate }) => {
      const { renders } = fixture();
      const encoder = (globalThis as unknown as { AudioEncoder: { isConfigSupported: (config: unknown) => Promise<unknown> } }).AudioEncoder;
      encoder.isConfigSupported = async (config) => ({ supported: false, config });
      const source = new Blob([Uint8Array.from(atob(aac), (char) => char.charCodeAt(0))]);
      const without = await renders.render({ source });
      const mixed = await renders.render({ source, mix: { inputGain: 1, layers: [{
        id: 'tone', source: renders.wav([new Float32Array(rate / 2).fill(0.2)], rate), outputStartSec: 0, outputEndSec: Infinity,
        sourceStartSec: 0, sourcePassSec: Infinity, gain: 1, fadeInSec: 0, fadeOutSec: 0, duck: null,
      }] } });
      return {
        mixDropped: mixed.mixDropped,
        audioDiscarded: mixed.audioDiscarded,
        keepsInput: (await renders.audioPacketsOf(mixed.blob!)) === (await renders.audioPacketsOf(without.blob!)),
      };
    }, { aac: aacSource, rate: RATE });
    expect(read).toEqual({ mixDropped: ['no-encodable-target-codec'], audioDiscarded: [], keepsInput: true });
  });
});

/** What the fixture bundle puts on the page, as the page functions use it. */
interface PageFixture {
  renders: import('@modules/video/mediabunny/audio/AudioMixRenderFixture.fixture').AudioMixRenderFixture;
  AudioGainEnvelope: typeof import('@modules/video/AudioGainEnvelope').AudioGainEnvelope;
  RenderTimeMap: typeof import('@modules/video/RenderTimeMap').RenderTimeMap;
  CustomAudioEncoder: typeof import('mediabunny').CustomAudioEncoder;
  EncodedPacket: typeof import('mediabunny').EncodedPacket;
  registerEncoder: typeof import('mediabunny').registerEncoder;
}

declare global {
  function fixture(): PageFixture;
}

async function inPage<Arg, Result>(body: (arg: Arg) => Promise<Result>, arg: Arg): Promise<Result> {
  const page: Page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>audio mix</title>' }));
    await page.goto('http://localhost/audio-mix');
    await page.addScriptTag({ content: `${bundle}\nwindow.fixture = () => audioMixFixture;` });
    return await page.evaluate(body as (arg: unknown) => Promise<Result>, arg as unknown);
  } finally {
    await page.close();
  }
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'audio-mix-render-fixture',
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
        output: { format: 'iife', name: 'audioMixFixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}
