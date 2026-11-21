import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';

/**
 * Pauses the video when a shot layer is picked. Lifecycle is
 * `start()` / `stop()`.
 *
 * A layer shows for its shot only, a few seconds, and what edits it —
 * its panel, its box on the preview — goes with it the moment the
 * playhead leaves, the same way a caption's does. Played on, the panel
 * would close under the user mid-edit. Picking a layer is asking to
 * work on it, so the playhead stays where it is; playing again is one
 * press away, and leaving the shot then closes the panel as usual.
 *
 * Fires once per pick, not on every change while a layer stays picked,
 * so pressing play with the layer picked plays.
 */
export class ShotLayerPickPlaybackController {
  private pickedLayerId: string | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly selection: OverlaySelectionController,
    private readonly pause: () => void,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.selection.subscribe(this.onSelectionChange);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pickedLayerId = null;
  }

  private readonly onSelectionChange = (): void => {
    const picked = this.selection.selectionSnapshot();
    const layerId = picked?.kind === 'shot-layer' ? picked.layerId : null;
    if (layerId === this.pickedLayerId) return;
    this.pickedLayerId = layerId;
    if (layerId !== null) this.pause();
  };
}
