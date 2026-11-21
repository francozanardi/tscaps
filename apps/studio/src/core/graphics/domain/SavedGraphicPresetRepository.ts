import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';

/**
 * The graphic presets a user saved, kept on this device. Each is kept
 * whole, its document and fields with it, so it opens without the project
 * it was saved from.
 */
export interface SavedGraphicPresetRepository {
  /** Every preset kept, the most recently saved first; one that cannot be read is left out. */
  list(): Promise<ReadonlyArray<GraphicPreset>>;
  /** Keeps `preset`: a new one as saved now, one already kept in place of it, keeping when it was first saved. */
  save(preset: GraphicPreset): Promise<void>;
  /** Forgets the preset `id`; nothing for one not kept. */
  delete(id: string): Promise<void>;
}
