import type { Input, OutputFormat as MediaBunnyOutputFormat } from 'mediabunny';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import type { AudioDiscardReason, AudioMixDropReason, RenderAudioMix } from '@modules/video/RenderJob';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';

export interface AudioTrackBridgeRequest {
  input: Input;
  /** The file `input` reads, for a decoder that has to read its audio again on its own. */
  source: Blob;
  format: MediaBunnyOutputFormat;
  /**
   * Maps source-time audio positions to output-time positions when
   * the render excludes one or more time windows. An empty mapper
   * passes audio through unchanged.
   */
  timeMap: RenderTimeMap;
  /** Length of the output, after the skipped windows have collapsed. */
  outputDurationSec: number;
  /** `false` for none of the input's own audio; not reported through {@link onAudioDiscarded}. */
  wanted: boolean;
  /**
   * Sounds mixed with the input's audio, and the level of that audio.
   * Without layers, and with the input's audio left at its own level or
   * not wanted, the request is served as if no mix were given.
   */
  mix?: RenderAudioMix;
  /**
   * Called when the input had an audio track but the bridge has to drop
   * it. Not invoked when the input has no audio at all.
   */
  onAudioDiscarded?: (reason: AudioDiscardReason) => void;
  /**
   * Called when the mix would change the audio but cannot be written;
   * the input's audio is then bridged as if no mix were given.
   */
  onAudioMixDropped?: (reason: AudioMixDropReason) => void;
  /**
   * Called once, with the WebCodecs error, when the input's audio is
   * mixed but WebCodecs fails to decode it and the fallback decoder
   * takes over. Should that fail too before anything is written, the
   * mix is then dropped through {@link onAudioMixDropped}.
   */
  onInputAudioFallback?: (cause: unknown) => void;
  /**
   * Asked, with their ids, whether to write the mix without the layers
   * whose source cannot be decoded; absent, or answered `false`, the
   * bridge rejects instead.
   */
  confirmUndecodableLayers?: (layerIds: ReadonlyArray<string>) => Promise<boolean>;
}

/**
 * Picks an appropriate {@link AudioTrackBridge} given the input file and
 * the chosen output container.
 */
export interface AudioTrackBridgeFactory {
  create(request: AudioTrackBridgeRequest): Promise<AudioTrackBridge>;
}
