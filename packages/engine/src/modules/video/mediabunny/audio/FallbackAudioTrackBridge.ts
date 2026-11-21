import type { Output } from 'mediabunny';
import type { AudioTrackBridge } from '@modules/video/mediabunny/audio/AudioTrackBridge';
import { InputAudioDecodeFailedError } from '@modules/video/mediabunny/audio/InputAudioDecodeFailedError';

/**
 * Bridges through a primary bridge and, when the primary cannot attach
 * because the input's own audio cannot be decoded
 * ({@link InputAudioDecodeFailedError}), through a fallback bridge made
 * then. Any other failure, and any failure after attaching, rejects as
 * the primary did: by then audio may already be in the output.
 */
export class FallbackAudioTrackBridge implements AudioTrackBridge {

  private active: AudioTrackBridge;

  /**
   * @param createFallback - Called at most once, when the primary
   * refuses; it is where the switch is reported.
   */
  constructor(
    private readonly primary: AudioTrackBridge,
    private readonly createFallback: () => Promise<AudioTrackBridge>,
  ) {
    this.active = primary;
  }

  async attachTo(output: Output): Promise<void> {
    try {
      await this.primary.attachTo(output);
    } catch (error) {
      if (!(error instanceof InputAudioDecodeFailedError)) throw error;
      this.active = await this.createFallback();
      await this.active.attachTo(output);
    }
  }

  pumpUntil(videoTimestamp: number): Promise<void> {
    return this.active.pumpUntil(videoTimestamp);
  }

  finish(): Promise<void> {
    return this.active.finish();
  }
}
