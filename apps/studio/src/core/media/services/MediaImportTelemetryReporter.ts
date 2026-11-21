import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import type { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetDestination } from '@core/media/services/MediaAssetOwnerResolver';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Where a file was added from: the media bin's picker or a drop on it, an
 * upload from a shot's or a layer's file picker, one from the sound
 * picker, or a file sent to the assistant from its panel.
 */
export type MediaImportOrigin = 'bin-picker' | 'bin-drop' | 'shot-upload' | 'layer-replace-upload' | 'sound-upload' | 'assistant-panel' | 'automation';

/**
 * Reports each file added to a project or to the library, and each file
 * refused or lost on the way in.
 *
 * A file is described by its kind, its MIME type, its weight, its length
 * and its size in pixels, never by its name. A refusal carries the names
 * of the error and of its cause, never their messages, which name the
 * file; the cause is what tells one gate from another. It also carries
 * how full the origin's storage was, since a file that could not be kept
 * most often met a full disk.
 */
export class MediaImportTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly errorNames: ErrorNameTelemetryDescriber,
    private readonly storageFootprint: StorageFootprintProbe,
  ) {}

  added(asset: MediaAsset, destination: MediaAssetDestination, origin: MediaImportOrigin): void {
    this.telemetry.capture('media_file_added', {
      type: asset.type,
      mime_type: asset.mimeType,
      size_mb: this.megabytes(asset.sizeBytes),
      duration_s: asset.durationSec === null ? null : Math.round(asset.durationSec * 10) / 10,
      width: asset.widthPx,
      height: asset.heightPx,
      owner: asset.owner.kind,
      destination,
      origin,
    });
  }

  /** `type` is the kind the file was taken for before it was read; null for one of no kind known. */
  failed(file: File, type: MediaAssetType | null, destination: MediaAssetDestination, origin: MediaImportOrigin, error: unknown): void {
    void this.captureFailure(file, type, destination, origin, error);
  }

  private async captureFailure(
    file: File,
    type: MediaAssetType | null,
    destination: MediaAssetDestination,
    origin: MediaImportOrigin,
    error: unknown,
  ): Promise<void> {
    const storage = await this.storageFootprint.measure();
    this.telemetry.capture('media_file_add_failed', {
      type,
      mime_type: file.type === '' ? null : file.type,
      size_mb: this.megabytes(file.size),
      destination,
      origin,
      ...this.errorNames.describe(error),
      ...storage,
    });
  }

  private megabytes(bytes: number): number {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  }
}
