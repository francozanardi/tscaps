import { describe, expect, it } from 'vitest';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import { DeleteSavedGraphicPresetAction } from '@core/graphics/actions/DeleteSavedGraphicPresetAction';
import { HydrateSavedGraphicPresetsAction } from '@core/graphics/actions/HydrateSavedGraphicPresetsAction';
import { RenameSavedGraphicPresetAction } from '@core/graphics/actions/RenameSavedGraphicPresetAction';
import { GraphicPresetNameValidator } from '@core/graphics/services/GraphicPresetNameValidator';
import { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';

/** Saved presets are read once, and renamed or deleted in storage and in what the editor shows alike. */

function presetOf(id: string): GraphicPreset {
  return {
    id,
    name: id,
    description: '',
    category: null,
    graphic: { document: { html: id, css: '', js: '' }, fields: [], params: {}, aspectRatio: 1, moments: [], presetId: id, hidesCaptions: false },
    box: { kind: 'full' },
    motion: { entrance: null, exit: null },
    sounds: [],
    style: null,
  };
}

class MemoryRepository implements SavedGraphicPresetRepository {
  constructor(readonly kept: GraphicPreset[], private readonly failing = false) {}

  async list(): Promise<ReadonlyArray<GraphicPreset>> {
    if (this.failing) throw new Error('Storage is not there.');
    return [...this.kept];
  }

  async save(preset: GraphicPreset): Promise<void> {
    if (this.failing) throw new Error('Storage is not there.');
    const index = this.kept.findIndex(({ id }) => id === preset.id);
    if (index >= 0) this.kept[index] = preset;
    else this.kept.unshift(preset);
  }

  async delete(id: string): Promise<void> {
    if (this.failing) throw new Error('Storage is not there.');
    this.kept.splice(this.kept.findIndex((preset) => preset.id === id), 1);
  }
}

describe('the saved graphic presets', () => {
  it('are read once, and an unreadable storage leaves them empty', async () => {
    const store = new SavedGraphicPresetStore();
    await new HydrateSavedGraphicPresetsAction(new MemoryRepository([presetOf('a'), presetOf('b')]), store).execute();
    expect(store.snapshot().map(({ id }) => id)).toEqual(['a', 'b']);

    const empty = new SavedGraphicPresetStore();
    await new HydrateSavedGraphicPresetsAction(new MemoryRepository([], true), empty).execute();
    expect(empty.snapshot()).toEqual([]);
  });

  it('are renamed in place, trimmed, and a name refused or a storage that fails changes nothing', async () => {
    const repository = new MemoryRepository([presetOf('a'), presetOf('b')]);
    const store = new SavedGraphicPresetStore();
    store.set([...repository.kept]);
    const rename = new RenameSavedGraphicPresetAction(repository, store, new GraphicPresetNameValidator());

    await rename.execute('b', '  Mine ');
    expect(store.snapshot().map(({ name }) => name)).toEqual(['a', 'Mine']);
    expect(repository.kept.map(({ name }) => name)).toEqual(['a', 'Mine']);

    await expect(rename.execute('a', ' ')).rejects.toThrow();
    await expect(rename.execute('a', 'x'.repeat(61))).rejects.toThrow();
    await expect(new RenameSavedGraphicPresetAction(new MemoryRepository([], true), store, new GraphicPresetNameValidator()).execute('a', 'Other')).rejects.toThrow();
    expect(store.snapshot().map(({ name }) => name)).toEqual(['a', 'Mine']);
  });

  it('are deleted from storage and from what the editor shows', async () => {
    const repository = new MemoryRepository([presetOf('a'), presetOf('b')]);
    const store = new SavedGraphicPresetStore();
    store.set([...repository.kept]);
    let heard = 0;
    store.subscribe(() => { heard += 1; });

    await new DeleteSavedGraphicPresetAction(repository, store).execute('a');
    expect(store.snapshot().map(({ id }) => id)).toEqual(['b']);
    expect(repository.kept.map(({ id }) => id)).toEqual(['b']);
    expect(heard).toBe(1);
  });
});
