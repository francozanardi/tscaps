import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import type { WaveformMemory } from '@core/audio/domain/WaveformMemory';

/**
 * A {@link WaveformExtractor} that answers from what it has already seen
 * before decoding anything: envelopes remembered by whoever decoded the
 * source for another reason, and envelopes it extracted itself.
 *
 * Kept per source object, weakly, so an envelope lives exactly as long as
 * the file it describes is still referenced; a source opened again from
 * storage is a different object and is decoded afresh.
 */
export class RememberingWaveformExtractor implements WaveformExtractor, WaveformMemory {

  private readonly known = new WeakMap<Blob, Map<number, Float32Array>>();

  constructor(private readonly inner: WaveformExtractor) {}

  async extract(source: Blob, peaksPerSecond: number): Promise<Float32Array> {
    const remembered = this.known.get(source)?.get(peaksPerSecond);
    if (remembered) return remembered;
    const peaks = await this.inner.extract(source, peaksPerSecond);
    this.remember(source, peaksPerSecond, peaks);
    return peaks;
  }

  remember(source: Blob, peaksPerSecond: number, peaks: Float32Array): void {
    const byRate = this.known.get(source) ?? new Map<number, Float32Array>();
    byRate.set(peaksPerSecond, peaks);
    this.known.set(source, byRate);
  }
}
