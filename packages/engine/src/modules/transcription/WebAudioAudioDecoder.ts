import { ALL_FORMATS, BlobSource, Input, type AudioSample } from 'mediabunny';
import { WebAudioAudioTrackSampleDecoder } from '@modules/audio-decoding/WebAudioAudioTrackSampleDecoder';
import type { AudioDecoder } from '@modules/transcription/AudioDecoder';

/**
 * Decodes an audio/video Blob to mono `Float32Array` PCM at the
 * requested sample rate through the Web Audio API. `decodeAudioData`
 * ships everywhere, so this covers runtimes whose WebCodecs has no
 * `AudioDecoder` (Safari before 26 is video-only).
 *
 * Peak memory does not follow the source's length: the audio track is
 * decoded in bounded segments into one pre-sized buffer, so the cost
 * is that buffer plus a single segment. The video track never loads.
 *
 * Main-thread only — `OfflineAudioContext` is not available inside
 * Worker contexts.
 *
 * Throws a `DOMException` named `NotSupportedError` for audio it
 * cannot decode and for a container it cannot read, following the
 * WebCodecs convention so callers classify both decode paths alike.
 */
export class WebAudioAudioDecoder implements AudioDecoder {

  private readonly trackDecoder: WebAudioAudioTrackSampleDecoder;

  /**
   * @param segmentSeconds - How much source audio one
   * `decodeAudioData` call covers. Trades peak memory against
   * per-segment setup; the decoded result is the same at any value.
   * Absent, a minute.
   */
  constructor(segmentSeconds?: number) {
    this.trackDecoder = new WebAudioAudioTrackSampleDecoder(segmentSeconds);
  }

  async decode(
    audio: Blob,
    targetSampleRate: number,
    onProgress?: (progress: number) => void,
  ): Promise<Float32Array> {
    const durationSeconds = await this.audioDurationOf(audio);
    if (durationSeconds === null) return new Float32Array(0);

    const target = new Float32Array(Math.max(1, Math.ceil(durationSeconds * targetSampleRate)));
    let written = 0;
    for await (const sample of this.trackDecoder.samples(audio, targetSampleRate)) {
      try {
        written = Math.max(written, this.downmixIntoTarget(target, sample));
        if (onProgress) onProgress(Math.min(1, (sample.timestamp + sample.duration) / durationSeconds));
      } finally {
        sample.close();
      }
    }
    if (onProgress) onProgress(1);
    return target.subarray(0, written);
  }

  /**
   * Returns the length of the source's primary audio track, or
   * `null` when it carries none.
   */
  private async audioDurationOf(audio: Blob): Promise<number | null> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(audio) });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return null;
      const durationSeconds = await track.computeDuration();
      return durationSeconds > 0 ? durationSeconds : null;
    } catch (cause) {
      throw this.notSupported('The source container could not be read', cause);
    } finally {
      input.dispose();
    }
  }

  /**
   * Downmixes the sample into the target at its timestamp, clipped to
   * the target's capacity. Returns the index one past the last frame
   * written.
   */
  private downmixIntoTarget(target: Float32Array, sample: AudioSample): number {
    const start = Math.round(sample.timestamp * sample.sampleRate);
    const skipped = Math.max(0, -start);
    const frames = Math.min(sample.numberOfFrames - skipped, target.length - Math.max(0, start));
    if (frames <= 0) return 0;
    const offset = Math.max(0, start);
    const plane = new Float32Array(sample.numberOfFrames);
    for (let channel = 0; channel < sample.numberOfChannels; channel += 1) {
      sample.copyTo(plane, { planeIndex: channel, format: 'f32-planar' });
      for (let frame = 0; frame < frames; frame += 1) target[offset + frame]! += plane[skipped + frame]!;
    }
    if (sample.numberOfChannels > 1) {
      const inverseChannels = 1 / sample.numberOfChannels;
      for (let frame = 0; frame < frames; frame += 1) target[offset + frame]! *= inverseChannels;
    }
    return offset + frames;
  }

  private notSupported(what: string, cause: unknown): DOMException {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new DOMException(`${what}: ${reason}`, 'NotSupportedError');
  }
}
