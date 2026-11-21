import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import type { MediaAssetUploadStatus } from '@core/media/domain/MediaAssetUploadStatus';

/** `MediaAssetUploader` where assets are kept on this device alone: there is nowhere to send or remove one. */
export class DeviceOnlyMediaAssetUploader implements MediaAssetUploader {
  enqueue(): void {}

  resume(): void {}

  retry(): void {}

  moved(): void {}

  remove(): Promise<void> {
    return Promise.resolve();
  }

  statusOf(): MediaAssetUploadStatus | null {
    return null;
  }

  hasUploadsInFlight(): boolean {
    return false;
  }

  subscribe(): () => void {
    return () => {};
  }
}
