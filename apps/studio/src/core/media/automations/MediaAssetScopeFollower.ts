import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LoadMediaAssetsAction } from '@core/media/actions/LoadMediaAssetsAction';
import type { MoveMediaAssetAction } from '@core/media/actions/MoveMediaAssetAction';
import type { MediaAssetListChanges } from '@core/media/domain/MediaAssetListChanges';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';

/**
 * Keeps the assets on offer in step with the open project: the
 * library alone when there is none, and that project's own beside it
 * once there is one.
 *
 * A project that gets its id while open takes the files added before
 * it had one, which were held for the page; from then on they live as
 * long as the project does.
 *
 * The open project's list is read again whenever `listChanges` says it
 * may have changed where it lives — a new project reaching the server,
 * which until then could only list the library beside it.
 */
export class MediaAssetScopeFollower {
  private projectId: string | null = null;
  private stopListening: (() => void) | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly assets: MediaAssetStore,
    private readonly load: LoadMediaAssetsAction,
    private readonly move: MoveMediaAssetAction,
    private readonly listChanges: MediaAssetListChanges,
  ) {}

  start(): void {
    this.projectId = this.editorStore.snapshot().projectId;
    this.editorStore.addEventListener('change', this.onChange);
    this.stopListening = this.listChanges.subscribe(this.onListChanged);
    this.reload();
  }

  stop(): void {
    this.editorStore.removeEventListener('change', this.onChange);
    this.stopListening?.();
    this.stopListening = null;
  }

  private readonly onChange = (): void => {
    const next = this.editorStore.snapshot().projectId;
    if (next === this.projectId) return;
    const gotItsId = this.projectId === null && next !== null;
    this.projectId = next;
    if (gotItsId) void this.adoptSessionAssets().finally(() => this.reload());
    else this.reload();
  };

  private readonly onListChanged = (projectId: string): void => {
    if (projectId !== this.projectId) return;
    this.load.refresh(projectId).catch((error: unknown) => {
      console.error('[media] the media files on offer could not be read again', error);
    });
  };

  private async adoptSessionAssets(): Promise<void> {
    const held = this.assets.snapshot().list().filter((asset) => asset.owner.kind === 'session');
    for (const asset of held) {
      await this.move.execute(asset.id, 'project').catch((error: unknown) => {
        console.error(`[media] asset ${asset.id} could not be given to the project`, error);
      });
    }
  }

  private reload(): void {
    this.load.execute(this.projectId).catch((error: unknown) => {
      console.error('[media] the media files on offer could not be brought up to date', error);
    });
  }
}
