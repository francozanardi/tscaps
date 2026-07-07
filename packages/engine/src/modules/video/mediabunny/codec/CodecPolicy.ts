import type { VideoCodec } from 'mediabunny';
import type { RenderQuality } from '@modules/video/RenderJob';

export interface VideoCodecResolutionRequest {
  /** Codecs the chosen output container can hold. */
  supportedCodecs: VideoCodec[];
  /** Display width of the input video, in pixels. */
  width: number;
  /** Display height of the input video, in pixels. */
  height: number;
  /** Average frame rate of the input video, in Hz. */
  fps: number;
  /** Subjective quality preset selected by the caller. */
  quality: RenderQuality | undefined;
}

export interface VideoCodecResolution {
  codec: VideoCodec;
  /** Target bitrate in bits per second. */
  bitrate: number;
  bitrateMode: 'constant' | 'variable';
  latencyMode: 'quality' | 'realtime';
  /** Optional hint about the content being encoded, e.g. `'text'` for high-contrast overlays. */
  contentHint?: string;
  /**
   * Distance, in seconds, between forced key frames. When omitted, the
   * encoder picks its default cadence. A short interval trades file
   * size for random-access granularity — useful for outputs that will
   * be scrubbed heavily (e.g. preview proxies).
   */
  keyFrameInterval?: number;
}

/**
 * Resolves codec, bitrate and encoder knobs for a render.
 *
 * Throws if no codec in `supportedCodecs` can be encoded by the host.
 */
export interface CodecPolicy {
  resolveVideo(request: VideoCodecResolutionRequest): Promise<VideoCodecResolution>;
}
