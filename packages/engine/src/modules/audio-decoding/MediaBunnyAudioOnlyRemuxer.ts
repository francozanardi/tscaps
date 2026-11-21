import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  type AudioCodec,
  type InputAudioTrack,
} from 'mediabunny';
import { AudioSegmentLayout } from '@modules/audio-decoding/AudioSegmentLayout';

/** An audio-only container covering one contiguous stretch of a source. */
export interface AudioOnlySegment {
  readonly bytes: Blob;
  /** Source timestamp the segment's first sample stands at, in seconds. */
  readonly startSeconds: number;
  /**
   * Source timestamp from which the samples are a faithful decode, in
   * seconds. What comes before is lead-in the previous segment
   * already covers properly.
   */
  readonly usableFromSeconds: number;
  /**
   * Source timestamp up to which the samples are a faithful decode, in
   * seconds; the next segment's `usableFromSeconds`, or `Infinity` for
   * a whole-track remux. What comes after is trail-out the next segment
   * covers properly.
   */
  readonly usableUntilSeconds: number;
}

/** A segment being filled: its output, its time origin and its extent. */
interface OpenAudioOnlySegment {
  readonly target: BufferTarget;
  readonly output: Output;
  readonly source: EncodedAudioPacketSource;
  readonly shiftSeconds: number;
  readonly usableFromSeconds: number;
  readonly usableUntilSeconds: number;
  readonly endsAtSeconds: number;
}

/**
 * Copies a media blob's primary audio track verbatim into audio-only
 * MP4 (m4a) containers. A packet copy touches no codec, so it works
 * without any WebCodecs support and never decodes the video track —
 * the result holds the audio at its original bitrate and nothing
 * else.
 *
 * The track comes out whole or split into segments of a bounded
 * length, each a stand-alone container that decodes on its own.
 * Segments overlap: to reassemble them, drop each one's lead-in —
 * everything before its `usableFromSeconds` — and place the rest at
 * that timestamp, either letting the next segment overwrite the
 * trail-out or cutting each at its `usableUntilSeconds`. Placing a
 * segment anywhere else, or appending it to the previous one, loses
 * the seam.
 *
 * Each segment's first packet is shifted to zero, which the muxer
 * requires. A whole-track remux keeps whatever lead-in the source
 * has and only corrects AAC's negative priming timestamp, a bias
 * bounded by the priming itself (~20 ms).
 *
 * Throws a plain `Error` when the source has no audio track, when
 * the container cannot carry its codec, and when the track holds no
 * packets at all; callers wrap it into their own error vocabulary.
 */
export class MediaBunnyAudioOnlyRemuxer {

  /**
   * How far a segment reaches beyond the stretch it is trusted for,
   * at both ends. Codecs reconstruct a frame together with its
   * neighbours, so the frames at a segment's edges decode attenuated
   * without them. Sized above the longest frame in common use
   * (60 ms, Opus).
   */
  private static readonly MARGIN_SECONDS = 0.15;

  async remux(media: Blob, onProgress?: (progress: number) => void): Promise<Blob> {
    for await (const segment of this.remuxSegments(media, Infinity, onProgress)) {
      return segment.bytes;
    }
    throw new Error('The source audio track has no packets');
  }

  /**
   * Yields the track as consecutive segments, each trusted for
   * `maxSegmentSeconds` of source time and carrying a margin of
   * context on either side of that. Segments are produced as they
   * are copied, so a consumer that decodes one at a time never
   * holds more than one decoded at once.
   */
  async *remuxSegments(
    media: Blob,
    maxSegmentSeconds: number,
    onProgress?: (progress: number) => void,
  ): AsyncGenerator<AudioOnlySegment> {
    const input = new Input({ source: new BlobSource(media), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) throw new Error('The source has no audio track');
      const codec = await this.carriableCodecOf(track);
      const decoderConfig = await track.getDecoderConfig();
      const meta = decoderConfig ? { decoderConfig } : {};
      const durationSeconds = await track.computeDuration();
      const layout = new AudioSegmentLayout(maxSegmentSeconds, MediaBunnyAudioOnlyRemuxer.MARGIN_SECONDS);
      const open: OpenAudioOnlySegment[] = [];
      let nextIndex = 0;

      for await (const packet of new EncodedPacketSink(track).packets()) {
        while (this.reached(packet.timestamp, layout, nextIndex, durationSeconds)) {
          // A segment whose whole stretch is behind this packet gets
          // no packets at all, so there is nothing to open for it.
          if (packet.timestamp < layout.endsAt(nextIndex)) {
            open.push(await this.open(codec, packet.timestamp, layout, nextIndex));
          }
          nextIndex += 1;
        }
        for (const segment of open) {
          await segment.source.add(packet.clone({ timestamp: packet.timestamp + segment.shiftSeconds }), meta);
        }
        while (open.length > 0 && packet.timestamp >= open[0]!.endsAtSeconds) {
          yield await this.close(open.shift()!);
        }
        if (onProgress && durationSeconds > 0) {
          onProgress(Math.min(1, packet.timestamp / durationSeconds));
        }
      }

      while (open.length > 0) yield await this.close(open.shift()!);
      if (onProgress) onProgress(1);
    } finally {
      input.dispose();
    }
  }

  /**
   * Whether the packet has reached the segment at `index`. A segment
   * trusted only from past the end of the track is never reached,
   * because it would be decoded for nothing.
   */
  private reached(
    timestampSeconds: number,
    layout: AudioSegmentLayout,
    index: number,
    durationSeconds: number,
  ): boolean {
    if (timestampSeconds < layout.collectsFrom(index)) return false;
    if (index === 0 || durationSeconds <= 0) return true;
    return layout.usableFrom(index) < durationSeconds;
  }

  private async open(
    codec: AudioCodec,
    anchorSeconds: number,
    layout: AudioSegmentLayout,
    index: number,
  ): Promise<OpenAudioOnlySegment> {
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const source = new EncodedAudioPacketSource(codec);
    output.addAudioTrack(source);
    await output.start();
    return {
      target,
      output,
      source,
      shiftSeconds: this.shiftFor(anchorSeconds, index === 0),
      usableFromSeconds: layout.usableFrom(index),
      usableUntilSeconds: layout.usableFrom(index + 1),
      endsAtSeconds: layout.endsAt(index),
    };
  }

  /**
   * A later segment is anchored to its own first packet, which is
   * what lets it be decoded on its own. The first one keeps whatever
   * lead-in the source has and only lifts the track above zero,
   * because moving it would silently retime a whole-track remux.
   */
  private shiftFor(anchorSeconds: number, isFirst: boolean): number {
    return isFirst ? Math.max(0, -anchorSeconds) : -anchorSeconds;
  }

  private async close(open: OpenAudioOnlySegment): Promise<AudioOnlySegment> {
    open.source.close();
    await open.output.finalize();
    if (!open.target.buffer) throw new Error('Remux finished without producing output');
    return {
      bytes: new Blob([open.target.buffer], { type: 'audio/mp4' }),
      startSeconds: Math.max(0, -open.shiftSeconds),
      usableFromSeconds: open.usableFromSeconds,
      usableUntilSeconds: open.usableUntilSeconds,
    };
  }

  private async carriableCodecOf(track: InputAudioTrack): Promise<AudioCodec> {
    const codec = await track.getCodec();
    const supported = new Mp4OutputFormat().getSupportedAudioCodecs();
    if (!codec || !supported.includes(codec)) {
      throw new Error(`The audio codec cannot be carried into an audio-only container: ${codec ?? 'unknown'}`);
    }
    return codec;
  }
}
