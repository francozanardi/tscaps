import { describe, expect, it } from 'vitest';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { LibraryGraphicPresetCatalog } from '@core/graphics/infrastructure/LibraryGraphicPresetCatalog';
import { GraphicPresetMatcher } from '@core/graphics/services/GraphicPresetMatcher';
import { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';

/**
 * The presets a graphic starts from are the saved ones, then the shipped
 * ones, read live; a graphic is the preset it started from where several
 * show its code, and is still known by its code once that one is gone.
 */
describe('LibraryGraphicPresetCatalog', () => {
  const builtins = new BuiltinGraphicPresetCatalog();
  const starter = builtins.starter();
  const savedCopy: GraphicPreset = { ...starter, id: 'saved-copy', name: 'My lower third', category: null, graphic: { ...starter.graphic, presetId: 'saved-copy' } };

  it('lists the saved presets first, as they are saved and deleted, and starts a first shot\'s graphic as a hook', () => {
    const saved = new SavedGraphicPresetStore();
    const catalog = new LibraryGraphicPresetCatalog(builtins, saved, new GraphicPresetMatcher());

    expect(catalog.list()).toEqual(builtins.list());
    saved.set([savedCopy]);
    expect(catalog.list()).toEqual([savedCopy, ...builtins.list()]);
    expect(catalog.starter()).toBe(starter);
    expect(catalog.openingStarter().id).toBe('hook-boxed-lines');
  });

  it('names a graphic by the preset it started from where several show its code, and by its code once that one is gone', () => {
    const saved = new SavedGraphicPresetStore();
    const catalog = new LibraryGraphicPresetCatalog(builtins, saved, new GraphicPresetMatcher());
    saved.set([savedCopy]);

    expect(catalog.presetOf(starter.graphic)).toBe(starter);
    expect(catalog.presetOf(savedCopy.graphic)).toBe(savedCopy);
    expect(catalog.originOf({ ...savedCopy.graphic, document: { html: 'edited', css: '', js: '' } })).toBe(savedCopy);

    saved.set([]);
    expect(catalog.presetOf(savedCopy.graphic)).toBe(starter);
    expect(catalog.originOf({ ...savedCopy.graphic, document: { html: 'edited', css: '', js: '' } })).toBeNull();
  });
});
