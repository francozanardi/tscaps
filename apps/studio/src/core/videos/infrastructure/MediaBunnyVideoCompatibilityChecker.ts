import {
  ALL_FORMATS,
  BlobSource,
  Input,
  Mp4OutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type InputVideoTrack,
} from 'mediabunny';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';
import { UnsupportedAudioCodecError } from '@core/videos/domain/errors/UnsupportedAudioCodecError';

/**
 * mediabunny-backed implementation of {@link VideoCompatibilityChecker}.
 * Opens the source through `Input` solely to read codec metadata —
 * no decoding or buffering — and closes the input before returning.
 */
export class MediaBunnyVideoCompatibilityChecker implements VideoCompatibilityChecker {
  private static readonly PROXY_TARGET_VIDEO_CODEC = 'avc';

  async check(source: Blob): Promise<void> {
    const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
    try {
      await this.checkVideoDecodable(input);
      await this.checkProxyVideoEncoderAvailable();
      await this.checkAudioCarriable(input);
    } finally {
      input.dispose();
    }
  }

  private async checkVideoDecodable(input: Input): Promise<void> {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new UnsupportedVideoCodecError({ codec: 'none' });
    }
    if (await track.canDecode()) return;
    throw new UnsupportedVideoCodecError({ codec: await this.readVideoCodec(track) });
  }

  private async readVideoCodec(track: InputVideoTrack): Promise<string> {
    return (await track.getCodec()) ?? 'unknown';
  }

  /**
   * Defensive check that the browser ships an H.264 encoder. Every
   * WebCodecs browser does in practice, but a missing encoder would
   * otherwise surface as an opaque conversion failure deep inside
   * proxy generation.
   */
  private async checkProxyVideoEncoderAvailable(): Promise<void> {
    const codec = MediaBunnyVideoCompatibilityChecker.PROXY_TARGET_VIDEO_CODEC;
    const encodable = await getFirstEncodableVideoCodec([codec]);
    if (encodable) return;
    throw new UnsupportedVideoCodecError({ codec: `${codec}-encoder` });
  }

  private async checkAudioCarriable(input: Input): Promise<void> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return;
    const codec = await track.getCodec();
    if (!codec) throw new UnsupportedAudioCodecError({ codec: 'unknown' });
    if (!(await track.canDecode())) throw new UnsupportedAudioCodecError({ codec });
    await this.assertAudioCodecHasContainerPath(codec);
  }

  /**
   * Confirms there is some way to carry the source audio codec into
   * the proxy container — either because the container already
   * accepts it (passthrough) or because the browser can transcode to
   * one of the container's supported codecs.
   */
  private async assertAudioCodecHasContainerPath(sourceCodec: string): Promise<void> {
    const supported = new Mp4OutputFormat().getSupportedAudioCodecs();
    if ((supported as readonly string[]).includes(sourceCodec)) return;
    const transcodeTarget = await getFirstEncodableAudioCodec(supported);
    if (transcodeTarget) return;
    throw new UnsupportedAudioCodecError({ codec: sourceCodec });
  }
}
