import type {
  CodecPolicy,
  VideoCodecResolution,
  VideoCodecResolutionRequest,
} from '@tscaps/engine';

/**
 * Codec policy for a converted original: H.264 whatever else the
 * browser encodes, since being decodable everywhere is the point of
 * the conversion, at the export's own bitrate for the high preset.
 *
 * The converted file is played as it is, without a preview proxy, so
 * it takes the proxy's one-second key frames: scrubbing seeks to a key
 * frame and decodes forward from it.
 */
export class ConvertedOriginalCodecPolicy implements CodecPolicy {

  private static readonly KEY_FRAME_INTERVAL_SEC = 1;

  constructor(private readonly exportPolicy: CodecPolicy) {}

  async resolveVideo(request: VideoCodecResolutionRequest): Promise<VideoCodecResolution> {
    const exportResolution = await this.exportPolicy.resolveVideo({ ...request, supportedCodecs: ['avc'], quality: 'high' });
    return {
      codec: exportResolution.codec,
      bitrate: exportResolution.bitrate,
      bitrateMode: exportResolution.bitrateMode,
      latencyMode: 'quality',
      keyFrameInterval: ConvertedOriginalCodecPolicy.KEY_FRAME_INTERVAL_SEC,
    };
  }
}
