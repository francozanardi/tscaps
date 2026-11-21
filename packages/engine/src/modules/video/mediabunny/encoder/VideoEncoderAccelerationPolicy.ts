import type { VideoEncodingConfig } from 'mediabunny';
import type { VideoEncoderSelection } from '@modules/video/RenderJob';

export interface VideoEncoderAccelerationRequest {
  width: number;
  height: number;
  /** Whether the frames carry transparency, as the run's encoder will be asked to keep it. */
  alpha: boolean;
  /**
   * What the run hands the encoder: snapshots of a painted canvas, or
   * frames as a decoder produced them, in memory. An encoder can take
   * one and refuse the other.
   */
  frames: 'painted' | 'decoded';
  /** The run's encoder config, before any acceleration hint is chosen. */
  encoderConfig: VideoEncodingConfig;
}

export interface VideoEncoderAccelerationResult {
  /** The config the run's encoder is built with: the request's, with the chosen hint applied. */
  encoderConfig: VideoEncodingConfig;
  selection: VideoEncoderSelection;
}

/**
 * Decides which hardware-acceleration hint a run's video encoder gets,
 * before the run opens its output: a track cannot change encoder once it
 * has been added, so the choice has to be settled ahead of the first
 * frame.
 */
export interface VideoEncoderAccelerationPolicy {
  select(request: VideoEncoderAccelerationRequest): Promise<VideoEncoderAccelerationResult>;
}
