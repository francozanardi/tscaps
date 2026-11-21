import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

/**
 * Why a file that plays was not added: it runs longer than one of its
 * type may, or it would not say how long it runs, which is read the
 * same way since the limit cannot be checked. Travels as the `cause` of
 * the import failure.
 */
export class MediaAssetTooLongError extends Error {
  readonly name = 'MediaAssetTooLongError';

  constructor(
    readonly type: MediaAssetType,
    /** How long the file runs, or null when it would not say. */
    readonly durationSec: number | null,
    readonly maxDurationSec: number,
  ) {
    super(durationSec === null
      ? `The ${type}'s length could not be read, so the ${maxDurationSec}s limit cannot be checked`
      : `The ${type} runs ${durationSec}s, past the ${maxDurationSec}s limit`);
  }
}
