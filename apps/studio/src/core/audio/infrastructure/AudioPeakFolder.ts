import type { AudioSample } from 'mediabunny';
import { ReusableSampleBuffer } from '@core/audio/infrastructure/ReusableSampleBuffer';

/**
 * Folds audio into a peak envelope: one bucket per `1 / peaksPerSecond`
 * seconds, holding the largest absolute amplitude seen inside it. Only the
 * first channel of a decoded sample is read.
 *
 * Folding is incremental, so a caller can feed samples as a decoder hands
 * them over and never hold the whole track. Each sample is placed by its
 * own timestamp, so gaps and reordering in the stream land where they
 * belong.
 */
export class AudioPeakFolder {

  private readonly scratch = new ReusableSampleBuffer();

  /** An empty envelope covering `durationSec` of audio. */
  emptyFor(durationSec: number, peaksPerSecond: number): Float32Array {
    return new Float32Array(Math.max(0, Math.floor(durationSec * peaksPerSecond)));
  }

  /** Folds one decoded sample into `peaks`. Frames past the envelope's end are ignored. */
  foldSample(sample: AudioSample, peaks: Float32Array, peaksPerSecond: number): void {
    const frameCount = sample.numberOfFrames;
    if (frameCount === 0) return;
    const view = this.scratch.viewOf(frameCount);
    sample.copyTo(view, { planeIndex: 0, format: 'f32-planar' });
    this.foldFrames(view, sample.timestamp, sample.sampleRate, peaks, peaksPerSecond);
  }

  /** The envelope of mono PCM that starts at the beginning of the audio. */
  ofPcm(pcm: Float32Array, sampleRate: number, peaksPerSecond: number): Float32Array {
    const peaks = this.emptyFor(pcm.length / sampleRate, peaksPerSecond);
    this.foldFrames(pcm, 0, sampleRate, peaks, peaksPerSecond);
    return peaks;
  }

  private foldFrames(
    frames: Float32Array,
    startSec: number,
    sampleRate: number,
    peaks: Float32Array,
    peaksPerSecond: number,
  ): void {
    const invSampleRate = 1 / sampleRate;
    const bucketCount = peaks.length;
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const bucketIndex = Math.floor((startSec + frameIndex * invSampleRate) * peaksPerSecond);
      if (bucketIndex < 0 || bucketIndex >= bucketCount) continue;
      const magnitude = Math.abs(frames[frameIndex]!);
      if (magnitude > peaks[bucketIndex]!) peaks[bucketIndex] = magnitude;
    }
  }
}
