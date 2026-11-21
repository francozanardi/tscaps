import type { AudioDuck, AudioLayer } from '@tscaps/engine';
import type { AudioScheduleClock } from '@core/preview/domain/AudioScheduleClock';

/**
 * Plays audio layers on an audio graph a host surface owns, each where
 * and as loud as the export mixes it: placed on output time, started
 * over every pass, shaped by the gain curve the engine's
 * `AudioGainEnvelope` answers. The host relays each of its gestures; the
 * player follows `clock` while playing.
 *
 * Sound is scheduled a short look-ahead ahead of the clock, never
 * further. Every file is opened once, whatever plays it and however
 * often the layers change.
 *
 * Layers play at the clock's rate, pitch shifted with it.
 *
 * It also drives the level of the host's own sound, on the parameter the
 * host hands it, along the curve the export applies to it.
 */
export interface PreviewAudioLayerPlayer {
  /**
   * Plays into `output` on `context`, timed by `clock`, and drives
   * `inputLevel`, the gain of the host's own sound. A later call moves
   * the player there, silencing what it was playing.
   */
  mount(context: AudioContext, output: AudioNode, clock: AudioScheduleClock, inputLevel: AudioParam): void;

  /** Silences everything and releases every file opened. */
  unmount(): void;

  /**
   * Replaces the layers. While playing, what changed is heard from now:
   * a layer whose sound did not change, only its level, keeps playing.
   * Files no layer plays any more are released; new ones start opening
   * at once. Kept across mounts.
   */
  setLayers(layers: ReadonlyArray<AudioLayer>, outputDurationSec: number): void;

  /**
   * Sets the level of the host's own sound, linear, shaped over each of
   * `ducks`' ranges; while playing, heard from now. Kept across mounts.
   */
  setInputLevel(gain: number, ducks: ReadonlyArray<AudioDuck>): void;

  /** Plays from `outputSec`, which the clock has just been set to and is running from. */
  playFrom(outputSec: number): void;

  /** Silences everything scheduled. A no-op while stopped. */
  stop(): void;
}
