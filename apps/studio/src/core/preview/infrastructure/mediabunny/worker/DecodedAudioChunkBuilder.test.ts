import { AudioSample } from 'mediabunny';
import { describe, expect, it } from 'vitest';
import { DecodedAudioChunkBuilder } from '@core/preview/infrastructure/mediabunny/worker/DecodedAudioChunkBuilder';

const RATE = 48_000;

/** A decoded sample of `left` and `right`, one value per frame, starting at `timestamp` seconds. */
function stereoSample(timestamp: number, left: number[], right: number[], sampleRate = RATE): AudioSample {
  return new AudioSample({
    data: new Float32Array([...left, ...right]),
    format: 'f32-planar',
    numberOfChannels: 2,
    sampleRate,
    timestamp,
  });
}

describe('decoded audio gathered into one run', () => {
  it('joins samples that follow one another, channel by channel, from the first one\'s time', () => {
    const chunk = new DecodedAudioChunkBuilder();
    const first = stereoSample(2, [0.1, 0.2], [-0.1, -0.2]);
    const second = stereoSample(2 + 2 / RATE, [0.3], [-0.3]);

    chunk.add(first);
    const broke = chunk.breaksWith(second);
    chunk.add(second);
    const run = chunk.take();

    expect(broke).toBe(false);
    expect(run.timestampSec).toBe(2);
    expect(run.sampleRate).toBe(RATE);
    expect(Array.from(run.channels[0]!)).toEqual([0.1, 0.2, 0.3].map(Math.fround));
    expect(Array.from(run.channels[1]!)).toEqual([-0.1, -0.2, -0.3].map(Math.fround));
  });

  it('says how long the sound held runs, and holds nothing once it is taken', () => {
    const chunk = new DecodedAudioChunkBuilder();

    chunk.add(stereoSample(0, new Array<number>(4800).fill(0), new Array<number>(4800).fill(0)));

    expect(chunk.durationSec()).toBeCloseTo(0.1, 6);
    chunk.take();
    expect(chunk.isEmpty()).toBe(true);
    expect(chunk.durationSec()).toBe(0);
  });

  it('refuses a sample that leaves a gap, or comes at another rate or channel count', () => {
    const chunk = new DecodedAudioChunkBuilder();
    chunk.add(stereoSample(1, [0, 0], [0, 0]));
    const mono = new AudioSample({ data: new Float32Array([0]), format: 'f32-planar', numberOfChannels: 1, sampleRate: RATE, timestamp: 1 + 2 / RATE });

    expect(chunk.breaksWith(stereoSample(1.5, [0], [0]))).toBe(true);
    expect(chunk.breaksWith(stereoSample(1 + 2 / RATE, [0], [0], 44_100))).toBe(true);
    expect(chunk.breaksWith(mono)).toBe(true);
  });

  it('takes any sample while it holds nothing', () => {
    expect(new DecodedAudioChunkBuilder().breaksWith(stereoSample(7, [0], [0]))).toBe(false);
  });
});
