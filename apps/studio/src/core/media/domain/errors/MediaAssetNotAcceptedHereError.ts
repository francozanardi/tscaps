import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

/**
 * Why a file was not added: it is a kind the editor takes, but not one
 * the place it was added for takes — a video picked to stand in for a
 * picture, or a picture for a video. Travels as the `cause` of the
 * import failure.
 */
export class MediaAssetNotAcceptedHereError extends Error {
  readonly name = 'MediaAssetNotAcceptedHereError';

  constructor(
    readonly type: MediaAssetType,
    readonly accepted: readonly MediaAssetType[],
  ) {
    super(`A file of type '${type}' was added where only ${accepted.join(', ')} are taken`);
  }
}
