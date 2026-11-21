import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

/**
 * Why a file was not added: it weighs more than one file of its type
 * may. Travels as the `cause` of the import failure.
 */
export class MediaAssetTooLargeError extends Error {
  readonly name = 'MediaAssetTooLargeError';

  constructor(
    readonly type: MediaAssetType,
    readonly sizeBytes: number,
    readonly maxBytes: number,
  ) {
    super(`A ${type} of ${sizeBytes} bytes is past the ${maxBytes}-byte limit`);
  }
}
