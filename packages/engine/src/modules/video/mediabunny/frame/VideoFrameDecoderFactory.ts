import type { InputVideoTrack } from 'mediabunny';
import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { FallbackDecoderInfo, VideoFrameDecoderSelection } from '@modules/video/RenderJob';

export interface VideoFrameDecoderRequest {
  /** The primary video track from the input file. */
  track: InputVideoTrack;
  /** The original input file, used by fallback decoders that rely on it. */
  source: File;
  /** `false` when only each frame's timing is needed, so nothing is decoded. */
  pixels: boolean;
  /**
   * Called when the factory would return a fallback decoder. Resolving
   * with `false` aborts the operation with an `AbortError`. When unset,
   * the factory uses the fallback without asking.
   */
  confirmFallback?: (info: FallbackDecoderInfo) => Promise<boolean>;
  /**
   * Called with the decoder the factory settled on, before it is
   * returned. Not invoked when the factory aborts instead.
   */
  onDecoderSelected?: (selection: VideoFrameDecoderSelection) => void;
}

/**
 * Picks an appropriate {@link VideoFrameDecoder} for the given input track.
 */
export interface VideoFrameDecoderFactory {
  create(request: VideoFrameDecoderRequest): Promise<VideoFrameDecoder>;
}
