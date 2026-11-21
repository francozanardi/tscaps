import { AudioSample } from 'mediabunny';
import type { AudioTrackSampleDecoder } from '@modules/audio-decoding/AudioTrackSampleDecoder';
import { MediaBunnyAudioOnlyRemuxer, type AudioOnlySegment } from '@modules/audio-decoding/MediaBunnyAudioOnlyRemuxer';

/**
 * {@link AudioTrackSampleDecoder} through the Web Audio API's
 * `decodeAudioData`, for browsers whose WebCodecs cannot decode the
 * track. The track's packets are copied, without decoding, into
 * audio-only segments of a bounded length, and each segment is decoded
 * on its own, so neither the source's video nor more than one decoded
 * segment is ever held in memory; one sample is yielded per segment.
 *
 * Main-thread only: `OfflineAudioContext` does not exist in workers.
 *
 * Rejects with a `NotSupportedError` `DOMException` whose message says
 * whether the track could not be read out of its container or could not
 * be decoded.
 */
export class WebAudioAudioTrackSampleDecoder implements AudioTrackSampleDecoder {

  private static readonly DEFAULT_SEGMENT_SECONDS = 60;

  private readonly remuxer = new MediaBunnyAudioOnlyRemuxer();

  /**
   * @param segmentSeconds - The longest stretch of source time decoded
   * at once.
   */
  constructor(
    private readonly segmentSeconds: number = WebAudioAudioTrackSampleDecoder.DEFAULT_SEGMENT_SECONDS,
  ) {}

  async *samples(source: Blob, sampleRate: number): AsyncGenerator<AudioSample> {
    for await (const segment of this.segmentsOf(source)) {
      const decoded = await this.decodeWithWebAudio(await segment.bytes.arrayBuffer(), sampleRate);
      const sample = this.usablePartOf(segment, decoded);
      if (sample) yield sample;
    }
  }

  private async *segmentsOf(source: Blob): AsyncGenerator<AudioOnlySegment> {
    try {
      yield* this.remuxer.remuxSegments(source, this.segmentSeconds);
    } catch (cause) {
      throw this.notSupported('The audio track could not be read out of its container', cause);
    }
  }

  private async decodeWithWebAudio(bytes: ArrayBuffer, sampleRate: number): Promise<AudioBuffer> {
    // decodeAudioData resamples to the context's rate, so a context
    // created at the target rate does the resampling in the same pass.
    const context = new OfflineAudioContext(1, 1, sampleRate);
    try {
      return await context.decodeAudioData(bytes);
    } catch (cause) {
      throw this.notSupported('Audio is not decodable by the Web Audio API', cause);
    }
  }

  /**
   * The frames of `decoded` the segment is trusted for — after its
   * lead-in and before its trail-out — placed at their source time;
   * `null` when none are left.
   */
  private usablePartOf(segment: AudioOnlySegment, decoded: AudioBuffer): AudioSample | null {
    const rate = decoded.sampleRate;
    const from = Math.max(0, Math.round((segment.usableFromSeconds - segment.startSeconds) * rate));
    const until = Number.isFinite(segment.usableUntilSeconds)
      ? Math.round((segment.usableUntilSeconds - segment.startSeconds) * rate)
      : decoded.length;
    const frames = Math.min(until, decoded.length) - from;
    if (frames <= 0) return null;
    const planar = new Float32Array(frames * decoded.numberOfChannels);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      planar.set(decoded.getChannelData(channel).subarray(from, from + frames), channel * frames);
    }
    return new AudioSample({
      data: planar,
      format: 'f32-planar',
      numberOfChannels: decoded.numberOfChannels,
      sampleRate: rate,
      timestamp: segment.usableFromSeconds,
    });
  }

  private notSupported(what: string, cause: unknown): DOMException {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new DOMException(`${what}: ${reason}`, 'NotSupportedError');
  }
}
