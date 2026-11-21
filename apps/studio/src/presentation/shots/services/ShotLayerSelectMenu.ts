import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import type { SelectableShotLayer } from '@presentation/shots/services/SelectableShotLayerReader';

/** One entry of the *Select* screen: every layer, every layer of a role, or none. */
export type ShotLayerSelectOptionId = 'all' | 'brolls' | 'pictures' | 'none';

/** What picking an entry of the *Select* screen would leave picked, and how the entry reads now. */
export interface ShotLayerSelectOption {
  readonly id: ShotLayerSelectOptionId;
  /** The layers left picked once it is chosen, and only those, in the panel's order. */
  readonly layerIds: ReadonlyArray<string>;
  /** Whether it can be chosen: a kind with no layer to pick, or a clear with nothing picked, cannot. */
  readonly isAvailable: boolean;
  /**
   * Whether what is picked is already exactly what it picks, so choosing
   * it would change nothing. Never true for an entry that is not available.
   */
  readonly isApplied: boolean;
}

/**
 * The entries of the layer selection's *Select* screen, read against the
 * layers that can be picked (in the panel's order) and what is picked
 * now. Each entry replaces the selection rather than adding to it, which
 * is what lets one say it is already applied.
 *
 * *Clear selection* is a command, not a set to be in: it is unavailable
 * while nothing is picked and never reads as applied.
 */
export class ShotLayerSelectMenu {
  optionsFor(
    selectable: ReadonlyArray<SelectableShotLayer>,
    selectedLayerIds: ReadonlySet<string>,
  ): ShotLayerSelectOption[] {
    return [
      this.setOption('all', selectable.map((layer) => layer.layerId), selectedLayerIds),
      this.setOption('brolls', this.layerIdsOfRole('video', selectable), selectedLayerIds),
      this.setOption('pictures', this.layerIdsOfRole('picture', selectable), selectedLayerIds),
      { id: 'none', layerIds: [], isAvailable: selectedLayerIds.size > 0, isApplied: false },
    ];
  }

  private setOption(
    id: ShotLayerSelectOptionId,
    layerIds: ReadonlyArray<string>,
    selectedLayerIds: ReadonlySet<string>,
  ): ShotLayerSelectOption {
    const isAvailable = layerIds.length > 0;
    const isApplied = isAvailable
      && layerIds.length === selectedLayerIds.size
      && layerIds.every((layerId) => selectedLayerIds.has(layerId));
    return { id, layerIds, isAvailable, isApplied };
  }

  private layerIdsOfRole(role: ShotLayerRole, selectable: ReadonlyArray<SelectableShotLayer>): string[] {
    return selectable.filter((layer) => layer.role === role).map((layer) => layer.layerId);
  }
}
