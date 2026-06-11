import { getFirstEncodableVideoCodec, type VideoCodec } from 'mediabunny';
import type { RenderQuality } from '@modules/video/RenderJob';
import type {
  CodecPolicy,
  VideoCodecResolution,
  VideoCodecResolutionRequest,
} from '@modules/video/mediabunny/codec/CodecPolicy';

/**
 * Resolves the video codec and encoder knobs for a render using a tiered
 * approach: a baseline bitrate driven by output resolution, scaled by the
 * codec's relative encoding efficiency, then scaled again by the chosen
 * quality preset.
 */
export class DefaultCodecPolicy implements CodecPolicy {

  /**
   * Linear scale applied to the base bitrate per quality preset. `high` is
   * the reference (1.0); the other values are deliberate, not derived from
   * a benchmark. They exist to give the caller a coarse knob to trade off
   * file size against fidelity.
   */
  private static readonly QUALITY_FACTORS: Record<RenderQuality, number> = {
    low: 0.5,
    medium: 0.75,
    high: 1.0,
    'very-high': 1.5,
  };

  /**
   * Relative bitrate needed by each codec to reach an equivalent perceptual
   * quality, with AVC/H.264 as the 1.0 reference.
   *
   * Numbers mirror mediabunny's own internal `codecEfficiencyFactors`
   * table (see `mediabunny/dist/modules/src/encode.js`), which in turn
   * follows widely-cited industry benchmarks: HEVC and VP9 deliver roughly
   * 40-50% bitrate savings over AVC (Bossen et al., HEVC Performance
   * Comparison, JCTVC-L1003), and AV1 around 30% over HEVC according to
   * Google's and Netflix's AV1 testing.
   */
  private static readonly CODEC_EFFICIENCY: Record<string, number> = {
    avc: 1.0,
    hevc: 0.6,
    vp9: 0.6,
    av1: 0.4,
    vp8: 1.2,
  };

  async resolveVideo(request: VideoCodecResolutionRequest): Promise<VideoCodecResolution> {
    const codec = await getFirstEncodableVideoCodec(request.supportedCodecs, {
      width: request.width,
      height: request.height,
    });
    if (!codec) {
      throw new Error(
        'No video encoder available in this browser for the selected output format. ' +
          'Try a different format or use a more recent version of Chrome, Firefox or Safari.',
      );
    }
    const bitrate = this.computeBitrate(codec, request.width, request.height, request.fps, request.quality);
    return {
      codec,
      bitrate,
      bitrateMode: 'variable',
      latencyMode: 'quality',
      // High-contrast text overlays benefit from the encoder spending more
      // bits on edge regions. Encoders that don't recognize this hint
      // (currently Firefox and Safari for most codecs) ignore it harmlessly.
      // See https://w3c.github.io/mst-content-hint/#video-content-hints
      contentHint: 'text',
    };
  }

  private computeBitrate(
    codec: VideoCodec,
    width: number,
    height: number,
    fps: number,
    quality: RenderQuality | undefined,
  ): number {
    const baseline = this.baselineBitrate(width, height);
    const codecFactor = DefaultCodecPolicy.CODEC_EFFICIENCY[codec] ?? 1.0;
    const qualityFactor = DefaultCodecPolicy.QUALITY_FACTORS[quality ?? 'high'];
    const fpsFactor = this.fpsFactor(fps);
    return Math.round(baseline * codecFactor * qualityFactor * fpsFactor);
  }

  /**
   * Baseline AVC bitrate in bits per second for the 30 fps SDR reference
   * of the given pixel area. Tiers track YouTube's recommended upload
   * bitrates for SDR 30 fps content, with a small headroom bump since
   * burned subtitles need extra bits to preserve text legibility:
   *
   *   YouTube recommendation:        ours:
   *     720p   ~5 Mbps                6 Mbps
   *     1080p  ~8 Mbps                12 Mbps
   *     1440p  ~16 Mbps               18 Mbps
   *     2160p  ~35-45 Mbps            40 Mbps
   *
   * Source: https://support.google.com/youtube/answer/1722171
   * (Recommended upload encoding settings → Bitrate.)
   */
  private baselineBitrate(width: number, height: number): number {
    const pixels = width * height;
    if (pixels <= 1280 * 720) return 6_000_000;
    if (pixels <= 1920 * 1080) return 12_000_000;
    if (pixels <= 2560 * 1440) return 18_000_000;
    return 40_000_000;
  }

  /**
   * Linear scale that turns the 30 fps baseline into the matching budget
   * for the actual frame rate. YouTube's tables show ~×1.5 between 30 fps
   * and 60 fps SDR at every resolution; the mapping below reproduces that
   * ratio and degrades gracefully past 60 fps.
   *
   *   fps ≤ 30: ×1.0
   *   fps = 45: ×1.25
   *   fps = 60: ×1.5
   *   fps = 120: ×2.5
   */
  private fpsFactor(fps: number): number {
    if (!Number.isFinite(fps) || fps <= 30) return 1;
    return 1 + (fps - 30) / 60;
  }
}
