import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';

/**
 * Starts bringing the originals of the assets a project uses to this
 * device, in the background, so an export finds them there instead of
 * waiting on them. Where the repository answers from the device alone,
 * this costs a read.
 *
 * Nothing waits on it and nothing it meets is an error worth raising:
 * whoever needs a file asks the repository again, which picks up a
 * download already under way.
 */
export class MediaAssetOriginalsPrefetcher {
  constructor(private readonly bytes: MediaAssetBytesRepository) {}

  prefetch(assetIds: Iterable<string>): void {
    for (const assetId of assetIds) {
      this.bytes.load(assetId, 'original').catch((error: unknown) => {
        console.error(`[media] asset ${assetId} could not be brought to this device`, error);
      });
    }
  }
}
