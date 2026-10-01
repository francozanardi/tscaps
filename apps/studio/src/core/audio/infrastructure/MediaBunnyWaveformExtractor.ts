import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny';
import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import type { AudioPeakFolder } from '@core/audio/infrastructure/AudioPeakFolder';

/**
 * mediabunny-backed streaming implementation of {@link WaveformExtractor}.
 *
 * Reads the primary audio track through {@link AudioSampleSink} sample
 * chunk by sample chunk, folding each chunk into the destination peak
 * buckets on arrival. Never materializes the full decoded PCM buffer —
 * transient memory use is one chunk of Float32 samples (~200 KB for a
 * typical 20 ms frame at 48 kHz) plus the fixed-size output peaks
 * array, regardless of source duration or file size.
 */
export class MediaBunnyWaveformExtractor implements WaveformExtractor {

  constructor(private readonly folder: AudioPeakFolder) {}

  async extract(source: Blob, peaksPerSecond: number): Promise<Float32Array> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source) });
    try {
      return await this.extractFromInput(input, peaksPerSecond);
    } finally {
      input.dispose();
    }
  }

  private async extractFromInput(input: Input, peaksPerSecond: number): Promise<Float32Array> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return new Float32Array(0);
    if (!(await track.canDecode())) return new Float32Array(0);

    const peaks = this.folder.emptyFor(await track.computeDuration(), peaksPerSecond);
    if (peaks.length === 0) return peaks;

    const sink = new AudioSampleSink(track);
    for await (const sample of sink.samples(0)) {
      try {
        this.folder.foldSample(sample, peaks, peaksPerSecond);
      } finally {
        sample.close();
      }
    }
    return peaks;
  }
}
