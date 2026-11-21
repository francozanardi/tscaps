import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import type { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';

/**
 * Fills the saved presets the editor shows from what this device keeps.
 * A storage that cannot be read leaves the list empty: the presets
 * shipped still show, and nothing a project holds depends on it.
 */
export class HydrateSavedGraphicPresetsAction {
  constructor(
    private readonly repository: SavedGraphicPresetRepository,
    private readonly store: SavedGraphicPresetStore,
  ) {}

  async execute(): Promise<void> {
    try {
      this.store.set(await this.repository.list());
    } catch (error) {
      console.error('[graphics] the saved presets could not be read', error);
    }
  }
}
