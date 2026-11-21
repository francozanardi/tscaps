import type { AudioLayerDecoder } from '@modules/video/mediabunny/audio/AudioLayerDecoder';

/**
 * {@link AudioLayerDecoder} that tries a primary decoder and, when it
 * fails for any reason, a fallback, file by file: one source falling
 * back does not move the others.
 *
 * When both fail it rejects with an `AggregateError` whose `errors` are
 * the primary's and the fallback's, in that order, and whose message
 * names both reasons.
 */
export class FallbackAudioLayerDecoder implements AudioLayerDecoder {

  constructor(
    private readonly primary: AudioLayerDecoder,
    private readonly fallback: AudioLayerDecoder,
  ) {}

  async decode(source: Blob, sampleRate: number): Promise<AudioBuffer> {
    let primaryError: unknown;
    try {
      return await this.primary.decode(source, sampleRate);
    } catch (error) {
      primaryError = error;
    }
    try {
      return await this.fallback.decode(source, sampleRate);
    } catch (fallbackError) {
      throw new AggregateError(
        [primaryError, fallbackError],
        `No audio decode path succeeded. Primary: ${this.describe(primaryError)}.`
        + ` Fallback: ${this.describe(fallbackError)}`,
        { cause: fallbackError },
      );
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  }
}
