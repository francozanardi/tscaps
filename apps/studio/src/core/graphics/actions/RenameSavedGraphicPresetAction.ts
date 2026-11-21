import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import type { GraphicPresetNameValidator } from '@core/graphics/services/GraphicPresetNameValidator';
import type { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';

/**
 * Calls a saved preset `name`, trimmed, keeping its place in the list.
 * Rejects for a name the validator refuses or a storage that fails, and
 * then changes nothing; does nothing for a preset not saved.
 */
export class RenameSavedGraphicPresetAction {
  constructor(
    private readonly repository: SavedGraphicPresetRepository,
    private readonly store: SavedGraphicPresetStore,
    private readonly names: GraphicPresetNameValidator,
  ) {}

  async execute(id: string, name: string): Promise<void> {
    const problem = this.names.problemWith(name);
    if (problem !== null) throw new Error(problem);
    const preset = this.store.snapshot().find((candidate) => candidate.id === id);
    if (preset === undefined) return;
    const renamed = { ...preset, name: name.trim() };
    await this.repository.save(renamed);
    this.store.set(this.store.snapshot().map((candidate) => (candidate.id === id ? renamed : candidate)));
  }
}
