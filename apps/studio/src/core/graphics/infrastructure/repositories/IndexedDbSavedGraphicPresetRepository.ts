import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import type { GraphicPresetManifestReader } from '@core/graphics/services/GraphicPresetManifestReader';
import type { GraphicPresetManifestWriter } from '@core/graphics/services/GraphicPresetManifestWriter';

/** The IndexedDB store the saved graphic presets live in. */
export const SAVED_GRAPHIC_PRESETS_STORE = 'graphic-presets';

interface SavedGraphicPresetRecord {
  readonly id: string;
  readonly savedAt: number;
  /** The preset as its manifest, document inline: the format a person or a model writes one in. */
  readonly manifest: Record<string, unknown>;
}

/**
 * `SavedGraphicPresetRepository` on the shared IndexedDB connection. Each
 * preset is one record keyed by its id, holding its manifest and when it
 * was first saved; a manifest is read back as a stored graphic is, and one
 * that cannot be read is left out.
 */
export class IndexedDbSavedGraphicPresetRepository implements SavedGraphicPresetRepository {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly reader: GraphicPresetManifestReader,
    private readonly writer: GraphicPresetManifestWriter,
  ) {}

  async list(): Promise<ReadonlyArray<GraphicPreset>> {
    const records = await this.db.readAll<SavedGraphicPresetRecord>(SAVED_GRAPHIC_PRESETS_STORE);
    return [...records]
      .sort((first, second) => (second.savedAt ?? 0) - (first.savedAt ?? 0))
      .flatMap((record) => {
        const manifest = record?.manifest;
        const preset = this.reader.read(manifest, manifest?.['document']);
        if (preset === null) console.warn(`[graphics] a saved preset could not be read (${record?.id ?? '?'})`);
        return preset === null ? [] : [preset];
      });
  }

  async save(preset: GraphicPreset): Promise<void> {
    const kept = await this.db.readOne<SavedGraphicPresetRecord>(SAVED_GRAPHIC_PRESETS_STORE, preset.id);
    const record: SavedGraphicPresetRecord = { id: preset.id, savedAt: kept?.savedAt ?? Date.now(), manifest: this.writer.write(preset) };
    await this.db.writeOne(SAVED_GRAPHIC_PRESETS_STORE, record);
  }

  delete(id: string): Promise<void> {
    return this.db.deleteOne(SAVED_GRAPHIC_PRESETS_STORE, id);
  }
}
