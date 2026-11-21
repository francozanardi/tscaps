import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import type { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';

/**
 * Forgets a saved preset. A graphic made from it keeps everything it
 * shows; it reads as custom from then on, and its reset goes back to no
 * preset. Rejects for a storage that fails, and then changes nothing.
 */
export class DeleteSavedGraphicPresetAction {
  constructor(
    private readonly repository: SavedGraphicPresetRepository,
    private readonly store: SavedGraphicPresetStore,
  ) {}

  async execute(id: string): Promise<void> {
    await this.repository.delete(id);
    this.store.set(this.store.snapshot().filter((preset) => preset.id !== id));
  }
}
