import type { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import { MediaAssetMoveFailedError } from '@core/media/domain/errors/MediaAssetMoveFailedError';
import type { MediaAssetDestination, MediaAssetOwnerResolver } from '@core/media/services/MediaAssetOwnerResolver';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { MediaLibraryTelemetryReporter } from '@core/media/services/MediaLibraryTelemetryReporter';

/**
 * Gives an asset to the open project or to the user's library. Only
 * the owner changes, and with it how long the asset lives: a project's
 * goes with the project, the library's stays until deleted. Shots that
 * show it keep showing it.
 *
 * The bytes move first: an asset leaving the session is written
 * durably then, which a full device can refuse, and the record must not
 * name an owner whose copy of the bytes was never written.
 *
 * Rejects with {@link MediaAssetMoveFailedError} when the library is not
 * open to whoever uses the editor now, the bytes could not be kept under
 * the new owner, or the move was refused or did not reach where the list
 * of files is kept; the asset then stays where it was.
 */
export class MoveMediaAssetAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly assets: MediaAssetStore,
    private readonly repository: MediaAssetRepository,
    private readonly bytes: MediaAssetBytesRepository,
    private readonly owners: MediaAssetOwnerResolver,
    private readonly uploader: MediaAssetUploader,
    private readonly telemetry: MediaLibraryTelemetryReporter,
  ) {}

  async execute(assetId: string, destination: MediaAssetDestination): Promise<void> {
    const asset = this.assets.snapshot().get(assetId);
    if (!asset) return;
    const owner = this.ownerFor(destination);
    if (this.owners.same(asset.owner, owner)) return;
    try {
      await this.bytes.reassign(asset.id, owner);
    } catch (cause) {
      throw new MediaAssetMoveFailedError({ cause });
    }
    try {
      await this.repository.move(asset, owner);
    } catch (cause) {
      await this.giveBytesBack(asset);
      throw new MediaAssetMoveFailedError({ cause });
    }
    const moved: MediaAsset = { ...asset, owner };
    this.uploader.moved(moved);
    this.assets.put(moved);
    this.telemetry.moved(asset.type, destination);
  }

  private ownerFor(destination: MediaAssetDestination): MediaAssetOwner {
    try {
      return this.owners.ownerFor(destination, this.editorStore.snapshot().projectId);
    } catch (cause) {
      throw new MediaAssetMoveFailedError({ cause });
    }
  }

  /**
   * Puts the bytes back under the owner the record still names. Best
   * effort: the move is already failing, and bytes under the wrong owner
   * only change when they are let go of, never whether they are read.
   */
  private async giveBytesBack(asset: MediaAsset): Promise<void> {
    try {
      await this.bytes.reassign(asset.id, asset.owner);
    } catch (error) {
      console.error(`[media] the bytes of asset ${asset.id} could not be given back after a failed move`, error);
    }
  }
}
