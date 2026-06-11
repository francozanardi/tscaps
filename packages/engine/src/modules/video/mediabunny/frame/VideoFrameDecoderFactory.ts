import type { InputVideoTrack } from 'mediabunny';
import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { FallbackDecoderInfo } from '@modules/video/RenderJob';

export interface VideoFrameDecoderRequest {
  /** The primary video track from the input file. */
  track: InputVideoTrack;
  /** The original input file, used by fallback decoders that rely on it. */
  source: File;
  /**
   * Called when the factory would return a fallback decoder. Resolving
   * with `false` aborts the operation with an `AbortError`. When unset,
   * the factory uses the fallback without asking.
   */
  confirmFallback?: (info: FallbackDecoderInfo) => Promise<boolean>;
}

/**
 * Picks an appropriate {@link VideoFrameDecoder} for the given input track.
 */
export interface VideoFrameDecoderFactory {
  create(request: VideoFrameDecoderRequest): Promise<VideoFrameDecoder>;
}
