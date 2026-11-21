import type { AudioSample } from 'mediabunny';
import type { DecodedAudioPayload } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';

// Decoders stamp each sample to the microsecond; a start further than this from the held sound's end is a real gap.
const CONTIGUITY_TOLERANCE_SEC = 0.001;

/**
 * Gathers decoded audio samples that follow one another into one run of
 * sound: a plane of 32-bit float samples per channel, starting at the
 * first sample's timestamp.
 *
 * A sample is copied out as it is added, so the caller closes it right
 * after.
 */
export class DecodedAudioChunkBuilder {
  private planesByChannel: Float32Array[][] = [];
  private frameCount = 0;
  private timestampSec = 0;
  private sampleRate = 0;

  isEmpty(): boolean {
    return this.frameCount === 0;
  }

  /** How long the sound held runs, in seconds. */
  durationSec(): number {
    return this.isEmpty() ? 0 : this.frameCount / this.sampleRate;
  }

  /**
   * Whether `sample` cannot be added to the sound held: it has another
   * rate or channel count, or does not start where that sound ends.
   * Never true while nothing is held.
   */
  breaksWith(sample: AudioSample): boolean {
    if (this.isEmpty()) return false;
    if (sample.sampleRate !== this.sampleRate || sample.numberOfChannels !== this.planesByChannel.length) return true;
    return Math.abs(sample.timestamp - (this.timestampSec + this.durationSec())) > CONTIGUITY_TOLERANCE_SEC;
  }

  /** Adds `sample` after the sound held. Only a sample that does not {@link breaksWith} it. */
  add(sample: AudioSample): void {
    if (this.isEmpty()) {
      this.timestampSec = sample.timestamp;
      this.sampleRate = sample.sampleRate;
      this.planesByChannel = Array.from({ length: sample.numberOfChannels }, () => []);
    }
    this.planesByChannel.forEach((planes, planeIndex) => {
      const plane = new Float32Array(sample.numberOfFrames);
      sample.copyTo(plane, { planeIndex, format: 'f32-planar' });
      planes.push(plane);
    });
    this.frameCount += sample.numberOfFrames;
  }

  /** Hands over the sound held as one run, and holds nothing after. Only while not {@link isEmpty}. */
  take(): DecodedAudioPayload {
    const payload: DecodedAudioPayload = {
      timestampSec: this.timestampSec,
      sampleRate: this.sampleRate,
      channels: this.planesByChannel.map((planes) => this.joined(planes)),
    };
    this.planesByChannel = [];
    this.frameCount = 0;
    return payload;
  }

  private joined(planes: ReadonlyArray<Float32Array>): Float32Array<ArrayBuffer> {
    const whole = new Float32Array(this.frameCount);
    let offset = 0;
    for (const plane of planes) {
      whole.set(plane, offset);
      offset += plane.length;
    }
    return whole;
  }
}
