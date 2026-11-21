import type { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { MediaLibraryTelemetryReporter } from '@core/media/services/MediaLibraryTelemetryReporter';

/**
 * Deletes an asset: takes it off every shot that shows it and every
 * clip of the soundtrack that plays it, stops making it ready, has it taken off the remote copy, and drops it from this
 * device. Cancelling a file still being prepared is this.
 *
 * The remote delete is recorded durably before anything here goes, so
 * a reload part-way still finishes it, and it is retried until the
 * remote copy confirms it.
 *
 * Nothing of it can be undone, and no undo step brings the asset back
 * to a shot or a clip either: the shots and the soundtrack lose it in
 * every step of the history. The project is marked unsaved only when a
 * shot or a clip lost it.
 */
export class RemoveMediaAssetAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly assets: MediaAssetStore,
    private readonly repository: MediaAssetRepository,
    private readonly bytes: MediaAssetBytesRepository,
    private readonly preparer: MediaAssetPreparer,
    private readonly uploader: MediaAssetUploader,
    private readonly telemetry: MediaLibraryTelemetryReporter,
  ) {}

  async execute(assetId: string): Promise<void> {
    const asset = this.assets.snapshot().get(assetId);
    const wasPreparing = this.preparer.statusOf(assetId)?.phase === 'preparing';
    const wasInUse = this.takeOffProject(assetId);
    if (asset) this.telemetry.deleted(asset.type, asset.owner, wasInUse, wasPreparing);
    this.assets.remove(assetId);
    await this.preparer.cancel(assetId);
    await this.uploader.remove(assetId);
    await this.bytes.delete(assetId);
    await this.repository.delete(assetId);
  }

  /** Takes the file off the open project; answers whether the project showed or played it. */
  private takeOffProject(assetId: string): boolean {
    const before = this.editorStore.snapshot();
    this.editorStore.reviseShots((shots) => shots.withoutMedia(assetId));
    this.editorStore.reviseAudio((audio) => audio.withoutMedia(assetId));
    const after = this.editorStore.snapshot();
    const wasInUse = after.shots !== before.shots || after.audio !== before.audio;
    if (wasInUse) this.editorStore.markDirty();
    return wasInUse;
  }
}
