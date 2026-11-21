import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';

/**
 * The graphic presets the user saved, as the editor shows them, the most
 * recently saved first. Pure state: the actions that save, rename and
 * delete own the storage and hand the new list here, and subscribers hear
 * each one.
 */
export class SavedGraphicPresetStore {
  private presets: ReadonlyArray<GraphicPreset> = [];
  private readonly listeners = new Set<() => void>();

  snapshot(): ReadonlyArray<GraphicPreset> {
    return this.presets;
  }

  set(presets: ReadonlyArray<GraphicPreset>): void {
    this.presets = presets;
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
