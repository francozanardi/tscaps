import type { RemoveShotLayersAction } from '@core/shots/actions/RemoveShotLayersAction';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';

/**
 * What the keyboard does to the shot layers picked: one on the preview,
 * or several picked together.
 *
 * Each command answers whether it acted, so a key it leaves alone still
 * reaches whatever else it is bound to. A shot layer picked on the
 * preview and a hold in the timeline are never in hand at once
 * (`TimelineLayerPickExclusionController`), so one press removes one
 * thing.
 */
export class ShotLayerShortcutCommands {
  constructor(
    private readonly selection: OverlaySelectionController,
    private readonly removeLayers: RemoveShotLayersAction,
  ) {}

  /**
   * Takes the picked layers off their shots, as one undo step: one
   * while it is on screen, several picked together wherever they are.
   * Not while focus is in the side panel or a popover, where the same
   * keys belong to the control in focus.
   */
  removePicked(): boolean {
    const layerIds = this.pickedLayerIds();
    if (layerIds.length === 0) return false;
    if (this.focusIsElsewhere()) return false;
    this.removeLayers.execute(layerIds, 'delete-key');
    return true;
  }

  private pickedLayerIds(): ReadonlyArray<string> {
    const picked = this.selection.paintedSelectionSnapshot();
    if (picked?.kind === 'shot-layer') return [picked.layerId];
    if (picked?.kind === 'shot-layers') return picked.layerIds;
    return [];
  }

  private focusIsElsewhere(): boolean {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) return false;
    return focused.closest('[data-tscaps-sidebar], [data-floating-layer]') !== null;
  }
}
