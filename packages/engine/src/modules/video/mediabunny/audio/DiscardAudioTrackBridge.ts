import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';

/**
 * No-op bridge used when the output should carry no audio, when the
 * input has none, or when its audio codec cannot be put into the chosen
 * output container without a transcode step the host can't perform. The
 * output ends up with no audio track.
 */
export class DiscardAudioTrackBridge implements AudioTrackBridge {

  async attachTo(): Promise<void> {
  }

  async pumpUntil(): Promise<void> {
  }

  async finish(): Promise<void> {
  }
}
