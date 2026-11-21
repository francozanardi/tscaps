import { describe, expect, it } from 'vitest';
import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';

/**
 * An audio tile's poster is its loudness across the whole file, so a
 * quiet file and a loud one with the same shape draw the same poster,
 * and a file this browser cannot decode draws none.
 */

class FixedWaveformExtractor implements WaveformExtractor {
  constructor(private readonly peaks: readonly number[]) {}

  extract(): Promise<Float32Array> {
    return Promise.resolve(Float32Array.from(this.peaks));
  }
}

class RefusingWaveformExtractor implements WaveformExtractor {
  extract(): Promise<Float32Array> {
    return Promise.reject(new Error('unreadable'));
  }
}

const file = () => new Blob(['sound'], { type: 'audio/mpeg' });

describe('the poster of an audio file', () => {
  it('draws each bar as the loudest moment of its stretch, against the loudest of the file', async () => {
    const sampler = new WaveformPosterSampler(new FixedWaveformExtractor([0.125, 0.25, 0.5, 0.125, 0.0625, 0.125, 0.375, 0.25]), 4);

    expect(await sampler.barsOf(file())).toEqual([0.5, 1, 0.25, 0.75]);
  });

  it('draws a quiet file and a loud one of the same shape alike', async () => {
    const quiet = new WaveformPosterSampler(new FixedWaveformExtractor([0.0625, 0.25, 0.125, 0.125]), 4);
    const loud = new WaveformPosterSampler(new FixedWaveformExtractor([0.25, 1, 0.5, 0.5]), 4);

    expect(await quiet.barsOf(file())).toEqual(await loud.barsOf(file()));
  });

  it('still fills every bar for a file shorter than the poster has bars', async () => {
    const sampler = new WaveformPosterSampler(new FixedWaveformExtractor([0.5, 1]), 4);

    expect(await sampler.barsOf(file())).toEqual([0.5, 0.5, 1, 1]);
  });

  it('draws a silent file flat, and no bars for one with no sound that decodes here', async () => {
    expect(await new WaveformPosterSampler(new FixedWaveformExtractor([0, 0, 0]), 3).barsOf(file())).toEqual([0, 0, 0]);
    expect(await new WaveformPosterSampler(new FixedWaveformExtractor([]), 3).barsOf(file())).toEqual([]);
  });

  it('lets a file that cannot be read fail alone, without holding up the next', async () => {
    const refusing = new WaveformPosterSampler(new RefusingWaveformExtractor());

    await expect(refusing.barsOf(file())).rejects.toThrow('unreadable');
    await expect(refusing.barsOf(file())).rejects.toThrow('unreadable');
  });
});
