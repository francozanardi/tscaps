import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  Input,
  type AudioSample,
} from 'mediabunny';
import type { WaveformExtractor } from '@core/cuts/domain/WaveformExtractor';
import { ReusableSampleBuffer } from '@core/cuts/infrastructure/ReusableSampleBuffer';

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

    const durationSec = await track.computeDuration();
    const bucketCount = Math.max(0, Math.floor(durationSec * peaksPerSecond));
    if (bucketCount === 0) return new Float32Array(0);

    const peaks = new Float32Array(bucketCount);
    const sink = new AudioSampleSink(track);
    const scratch = new ReusableSampleBuffer();

    for await (const sample of sink.samples(0)) {
      try {
        this.foldSampleIntoPeaks(sample, peaks, peaksPerSecond, scratch);
      } finally {
        sample.close();
      }
    }

    return peaks;
  }

  private foldSampleIntoPeaks(
    sample: AudioSample,
    peaks: Float32Array,
    peaksPerSecond: number,
    scratch: ReusableSampleBuffer,
  ): void {
    const frameCount = sample.numberOfFrames;
    if (frameCount === 0) return;
    const view = scratch.viewOf(frameCount);
    sample.copyTo(view, { planeIndex: 0, format: 'f32-planar' });

    const startSec = sample.timestamp;
    const invSampleRate = 1 / sample.sampleRate;
    const bucketCount = peaks.length;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const frameSec = startSec + frameIndex * invSampleRate;
      const bucketIndex = Math.floor(frameSec * peaksPerSecond);
      if (bucketIndex < 0 || bucketIndex >= bucketCount) continue;
      const magnitude = Math.abs(view[frameIndex]!);
      if (magnitude > peaks[bucketIndex]!) peaks[bucketIndex] = magnitude;
    }
  }
}

