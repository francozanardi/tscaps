import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';

/**
 * {@link AudioPlaybackProbe} that asks `primary` first and, on any
 * refusal, `fallback`: a file either decoder can read plays, since the
 * sound is decoded the same way, one decoder and then the other.
 * Rejects with the fallback's refusal, carrying the primary's as its
 * `cause`.
 */
export class FallbackAudioPlaybackProbe implements AudioPlaybackProbe {
  constructor(
    private readonly primary: AudioPlaybackProbe,
    private readonly fallback: AudioPlaybackProbe,
  ) {}

  async ensurePlayable(audio: Blob): Promise<void> {
    try {
      await this.primary.ensurePlayable(audio);
    } catch (primaryRefusal) {
      await this.fallback.ensurePlayable(audio).catch((fallbackRefusal: unknown) => {
        throw new Error(`Neither decoder plays this file: ${this.messageOf(fallbackRefusal)}`, { cause: primaryRefusal });
      });
    }
  }

  private messageOf(refusal: unknown): string {
    return refusal instanceof Error ? refusal.message : String(refusal);
  }
}
