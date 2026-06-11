import type { VideoEncodingConfig } from 'mediabunny';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

export interface VideoTrackEncoderFactoryRequest {
  width: number;
  height: number;
  encoderConfig: VideoEncodingConfig;
}

/**
 * Builds a {@link VideoTrackEncoder} sized to the requested output. The
 * renderer asks the factory for a fresh encoder per render, once the
 * input dimensions and resolved codec config are known.
 */
export interface VideoTrackEncoderFactory {
  create(request: VideoTrackEncoderFactoryRequest): VideoTrackEncoder;
}
