import type { Rotation, VideoEncodingConfig } from 'mediabunny';
import type { VideoTrackEncoder } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

export interface VideoTrackEncoderFactoryRequest {
  /** Width of the frames as stored, before the track's rotation. */
  width: number;
  /** Height of the frames as stored, before the track's rotation. */
  height: number;
  /** Whether the frames carry transparency; each one then starts fully transparent. */
  alpha: boolean;
  /**
   * Clockwise rotation the track declares, for a player to apply on
   * display. `0` when the frames are encoded upright.
   */
  rotation: Rotation;
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
