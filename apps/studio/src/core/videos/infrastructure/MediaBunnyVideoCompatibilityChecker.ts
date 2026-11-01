import {
  ALL_FORMATS,
  BlobSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  VideoSampleSink,
  getFirstEncodableAudioCodec,
  type AudioCodec,
  type InputAudioTrack,
  type InputVideoTrack,
} from 'mediabunny';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';
import { UnsupportedAudioCodecError } from '@core/videos/domain/errors/UnsupportedAudioCodecError';
import { VideoTrackMissingError } from '@core/videos/domain/errors/VideoTrackMissingError';

/**
 * mediabunny-backed implementation of {@link VideoCompatibilityChecker}.
 * Opens the source through `Input`, reads codec metadata, and decodes
 * exactly one video frame to prove the browser's decoder handles the
 * real bitstream, then closes the input before returning. Audio is
 * checked from metadata only.
 */
export class MediaBunnyVideoCompatibilityChecker implements VideoCompatibilityChecker {

  async check(source: Blob): Promise<void> {
    const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
    try {
      await this.checkVideoDecodable(input);
      await this.checkAudioCarriable(input);
    } finally {
      input.dispose();
    }
  }

  private async checkVideoDecodable(input: Input): Promise<void> {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new VideoTrackMissingError();
    }
    if (!(await this.browserDecodes(track))) {
      throw new UnsupportedVideoCodecError({ codec: await this.readVideoCodec(track) });
    }
    await this.checkFirstFrameDecodes(track);
  }

  /**
   * Asks the browser's own decoder, where `track.canDecode()` also
   * counts the decoders registered with mediabunny. A software decoder
   * installed to convert a source answers for its codec in this
   * session only: a source admitted on its word would not play in a
   * `<video>` element now, nor decode at all in the next session.
   */
  private async browserDecodes(track: InputVideoTrack): Promise<boolean> {
    if (typeof VideoDecoder === 'undefined') return false;
    try {
      const decoderConfig = await track.getDecoderConfig();
      if (!decoderConfig) return false;
      return (await VideoDecoder.isConfigSupported(decoderConfig)).supported === true;
    } catch (cause) {
      // A config that cannot be read or that the browser cannot parse
      // is one it cannot decode.
      console.warn('[video-compatibility] decoder config refused', cause);
      return false;
    }
  }

  /**
   * `canDecode` only asks the browser whether a decoder for the codec
   * string exists; browsers answer yes and still fail on the actual
   * bitstream (hardware profile limits, corrupt samples). Decoding one
   * real frame catches those upfront instead of deep inside a later
   * pipeline stage.
   */
  private async checkFirstFrameDecodes(track: InputVideoTrack): Promise<void> {
    try {
      const sink = new VideoSampleSink(track);
      const sample = await sink.getSample(await track.getFirstTimestamp());
      if (!sample) {
        throw new Error(`The decoder produced no sample for the first frame (${await this.describeFirstPacket(track)}).`);
      }
      sample.close();
    } catch (cause) {
      throw new UnsupportedVideoCodecError({ codec: await this.readVideoCodec(track), cause });
    }
  }

  /**
   * What the source's first frame looks like to the demuxer, for a
   * report that has to explain a failure seen only on someone else's
   * file: the full codec string, the first packet's type as the
   * container flags it and as its bitstream reads, and where the first
   * keyframe that passes that reading sits. A container keyframe the
   * bitstream calls a delta (an open-GOP I-frame cut out of its group)
   * is the case this exists to tell apart from a decoder that refused
   * the stream.
   */
  private async describeFirstPacket(track: InputVideoTrack): Promise<string> {
    const decoderConfig = await track.getDecoderConfig();
    const packets = new EncodedPacketSink(track);
    const firstPacket = await packets.getFirstPacket();
    if (!firstPacket) return `codec ${decoderConfig?.codec ?? 'unknown'}, no packets`;
    const bitstreamType = await track.determinePacketType(firstPacket);
    const firstVerifiedKey = await packets.getNextKeyPacket(firstPacket, { verifyKeyPackets: true });
    return [
      `codec ${decoderConfig?.codec ?? 'unknown'}`,
      `first packet at ${firstPacket.timestamp}s`,
      `container says ${firstPacket.type}`,
      `bitstream says ${bitstreamType ?? 'unknown'}`,
      `next verified keyframe ${firstVerifiedKey ? `at ${firstVerifiedKey.timestamp}s` : 'none'}`,
    ].join(', ');
  }

  private async readVideoCodec(track: InputVideoTrack): Promise<string> {
    return (await track.getCodec()) ?? 'unknown';
  }

  /**
   * Confirms there is some way to carry the source audio codec into
   * the proxy container. Passthrough (the container accepts the codec
   * as-is) is a packet copy and needs no decoder, so it must not be
   * gated on `canDecode` — WebCodecs without an `AudioDecoder`
   * (Safari before 26 is video-only) still carries AAC fine, and the
   * decode paths downstream fall back to the Web Audio API. Only the
   * transcode path needs the WebCodecs pair to exist.
   */
  private async checkAudioCarriable(input: Input): Promise<void> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return;
    const codec = await track.getCodec();
    if (!codec) throw new UnsupportedAudioCodecError({ codec: 'unknown' });
    const supported = new Mp4OutputFormat().getSupportedAudioCodecs();
    if ((supported as readonly string[]).includes(codec)) return;
    if (await this.canTranscodeAudio(track, supported)) return;
    throw new UnsupportedAudioCodecError({ codec });
  }

  private async canTranscodeAudio(track: InputAudioTrack, targetCodecs: AudioCodec[]): Promise<boolean> {
    if (!(await track.canDecode())) return false;
    return (await getFirstEncodableAudioCodec(targetCodecs)) !== null;
  }
}
