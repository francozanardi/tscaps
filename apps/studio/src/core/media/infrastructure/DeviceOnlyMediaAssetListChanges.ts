import type { MediaAssetListChanges } from '@core/media/domain/MediaAssetListChanges';

/**
 * `MediaAssetListChanges` for a list kept on this device alone, which
 * only this page's own actions change: it never has anything to say.
 */
export class DeviceOnlyMediaAssetListChanges implements MediaAssetListChanges {
  subscribe(): () => void {
    return () => {};
  }
}
