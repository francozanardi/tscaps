import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import { WAVEFORM_PEAKS_PER_SECOND } from '@core/audio/domain/WaveformResolution';

/**
 * Makes the poster of an audio file: its loudness across its whole
 * length, as a few bars a tile can draw at any size.
 *
 * Each bar is the loudest moment of its stretch of the file, scaled to
 * the loudest moment of the whole, so a quiet file shows its shape as
 * clearly as a loud one; a silent file is all zeros, and a file with no
 * sound that decodes here has no bars at all. Files are read one at a
 * time, since reading one decodes all of its sound, and posters already
 * made are answered from memory for as long as the file itself is held.
 */
export class WaveformPosterSampler {
  private readonly posters = new WeakMap<Blob, Promise<readonly number[]>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly extractor: WaveformExtractor,
    private readonly barCount: number = 40,
  ) {}

  /** The heights of the poster's bars, each in `[0, 1]`, first to last; empty for a file with no sound that decodes here. */
  barsOf(source: Blob): Promise<readonly number[]> {
    const known = this.posters.get(source);
    if (known) return known;
    const poster = this.queue.then(() => this.read(source));
    // The chain must survive a rejected link, or one unreadable file
    // would fail every poster queued behind it.
    this.queue = poster.catch(() => undefined);
    this.posters.set(source, poster);
    // A failed read is not kept, so asking again tries again.
    poster.catch(() => this.posters.delete(source));
    return poster;
  }

  private async read(source: Blob): Promise<readonly number[]> {
    const peaks = await this.extractor.extract(source, WAVEFORM_PEAKS_PER_SECOND);
    return this.scaled(this.folded(peaks));
  }

  /** `peaks` gathered into the poster's bars, each the loudest peak of its stretch. */
  private folded(peaks: Float32Array): number[] {
    if (peaks.length === 0) return [];
    const bars: number[] = [];
    for (let bar = 0; bar < this.barCount; bar += 1) {
      const start = Math.floor((bar * peaks.length) / this.barCount);
      const end = Math.max(start + 1, Math.floor(((bar + 1) * peaks.length) / this.barCount));
      let loudest = 0;
      for (let index = start; index < end && index < peaks.length; index += 1) loudest = Math.max(loudest, peaks[index]!);
      bars.push(loudest);
    }
    return bars;
  }

  private scaled(bars: number[]): number[] {
    const loudest = Math.max(0, ...bars);
    return loudest === 0 ? bars : bars.map((height) => height / loudest);
  }
}
