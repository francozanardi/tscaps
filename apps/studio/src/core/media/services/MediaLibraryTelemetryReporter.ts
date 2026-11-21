import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetDestination } from '@core/media/services/MediaAssetOwnerResolver';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Reports what is done with files once added: moved between a project and
 * the library, or deleted. A file is described by its kind, never by its
 * name or id.
 */
export class MediaLibraryTelemetryReporter {
  constructor(private readonly telemetry: Telemetry) {}

  moved(type: MediaAssetType, to: MediaAssetDestination): void {
    this.telemetry.capture('media_file_moved', { type, to });
  }

  /**
   * `wasInUse` says the open project showed or played the file, and lost
   * it with the delete; `wasPreparing` that its preview copy was still
   * being made.
   */
  deleted(type: MediaAssetType, owner: MediaAssetOwner, wasInUse: boolean, wasPreparing: boolean): void {
    this.telemetry.capture('media_file_deleted', {
      type,
      owner: owner.kind,
      was_in_use: wasInUse,
      was_preparing: wasPreparing,
    });
  }
}
