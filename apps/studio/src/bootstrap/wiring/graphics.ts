import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import { DeleteSavedGraphicPresetAction } from '@core/graphics/actions/DeleteSavedGraphicPresetAction';
import { HydrateSavedGraphicPresetsAction } from '@core/graphics/actions/HydrateSavedGraphicPresetsAction';
import { RenameSavedGraphicPresetAction } from '@core/graphics/actions/RenameSavedGraphicPresetAction';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { LibraryGraphicPresetCatalog } from '@core/graphics/infrastructure/LibraryGraphicPresetCatalog';
import {
  IndexedDbSavedGraphicPresetRepository,
  SAVED_GRAPHIC_PRESETS_STORE,
} from '@core/graphics/infrastructure/repositories/IndexedDbSavedGraphicPresetRepository';
import { StoredGraphicPresetStyleReader } from '@core/graphics/infrastructure/StoredGraphicPresetStyleReader';
import { GraphicPresetManifestReader } from '@core/graphics/services/GraphicPresetManifestReader';
import { GraphicPresetManifestWriter } from '@core/graphics/services/GraphicPresetManifestWriter';
import { GraphicPresetMatcher } from '@core/graphics/services/GraphicPresetMatcher';
import { GraphicPresetNameValidator } from '@core/graphics/services/GraphicPresetNameValidator';
import { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';
import { AnyOriginCssResourceUrlPolicy, BrowserCssResourceEmbedder } from '@tscaps/engine';
import { FONT_FAMILIES } from '@core/fonts/domain/FontFamilyCatalog';
import type { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import { GraphicFontFacesBuilder } from '@core/graphics/services/GraphicFontFacesBuilder';
import { GraphicFontFamilyFinder } from '@core/graphics/services/GraphicFontFamilyFinder';
import { SandboxedGraphicPage } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPage';
import { SandboxedGraphicPlayerFactory } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPlayerFactory';

/**
 * Builds what plays graphics: each in a sandboxed frame of its own, kept
 * off screen in `container`, isolated from the editor and from the
 * network, holding the bundled fonts it names as `fontFaces` writes them.
 */
export function buildGraphicPlayers(container: HTMLElement, fontFaces: FontFaceCssBuilder): GraphicPlayerFactory {
  const graphicFontFaces = new GraphicFontFacesBuilder(
    new GraphicFontFamilyFinder(FONT_FAMILIES),
    fontFaces,
    new BrowserCssResourceEmbedder(new AnyOriginCssResourceUrlPolicy()),
  );
  return new SandboxedGraphicPlayerFactory(container, new SandboxedGraphicPage(), graphicFontFaces);
}

export interface GraphicPresetsDependencies {
  readonly indexedDb: IndexedDbClient;
}

export type GraphicPresetsModule = ReturnType<typeof bootGraphicPresets>;

/**
 * Boots the graphic presets: the ones shipped and the ones the user saved
 * on this device, offered together by `catalog`. The saved ones start
 * empty and arrive once `actions.hydrate` has read them, so the editor
 * does not wait on storage to open.
 */
export function bootGraphicPresets(deps: GraphicPresetsDependencies) {
  const store = new SavedGraphicPresetStore();
  const repository = new IndexedDbSavedGraphicPresetRepository(
    deps.indexedDb,
    new GraphicPresetManifestReader(new GraphicSanitizer(), new StoredGraphicPresetStyleReader()),
    new GraphicPresetManifestWriter(),
  );
  const names = new GraphicPresetNameValidator();
  const shipped = new BuiltinGraphicPresetCatalog();
  const catalog = new LibraryGraphicPresetCatalog(shipped, store, new GraphicPresetMatcher());
  return {
    store,
    repository,
    names,
    catalog,
    telemetryDescriber: new GraphicTelemetryDescriber(shipped, catalog),
    actions: {
      hydrate: new HydrateSavedGraphicPresetsAction(repository, store),
      rename: new RenameSavedGraphicPresetAction(repository, store, names),
      delete: new DeleteSavedGraphicPresetAction(repository, store),
    },
  };
}

export function buildSavedGraphicPresetsIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return { name: SAVED_GRAPHIC_PRESETS_STORE, keyPath: 'id' };
}
