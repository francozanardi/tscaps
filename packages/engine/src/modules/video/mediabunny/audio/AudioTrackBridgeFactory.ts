import type { Input, OutputFormat as MediaBunnyOutputFormat } from 'mediabunny';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { AudioDiscardReason } from '@modules/video/RenderJob';

export interface AudioTrackBridgeRequest {
  input: Input;
  format: MediaBunnyOutputFormat;
  /**
   * Called when the input had an audio track but the bridge has to drop
   * it. Not invoked when the input has no audio at all.
   */
  onAudioDiscarded?: (reason: AudioDiscardReason) => void;
}

/**
 * Picks an appropriate {@link AudioTrackBridge} given the input file and
 * the chosen output container.
 */
export interface AudioTrackBridgeFactory {
  create(request: AudioTrackBridgeRequest): Promise<AudioTrackBridge>;
}
