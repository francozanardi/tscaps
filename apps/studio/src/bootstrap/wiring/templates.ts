import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import { BUILTIN_TEMPLATE_NAMES } from '@core/templates/domain/BuiltinTemplateNames';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import type { TemplateFavoritesRepository } from '@core/templates/domain/favorites/TemplateFavoritesRepository';
import { IndexedDbTemplateFavoritesRepository } from '@core/templates/infrastructure/repositories/IndexedDbTemplateFavoritesRepository';
import { LocalStorageTemplateUsageRepository } from '@core/templates/infrastructure/repositories/LocalStorageTemplateUsageRepository';
import { LocalFileTemplateLoader } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import { BUILTIN_TEMPLATE_ASSETS } from '@core/templates/infrastructure/BuiltinTemplateAssets';
import { BUILTIN_ASSETS } from '@core/assets/infrastructure/BuiltinAssets';
import { BuiltinTemplateRepository } from '@core/templates/infrastructure/repositories/BuiltinTemplateRepository';
import { TemplateLibraryStore } from '@core/templates/store/TemplateLibraryStore';
import { ToggleTemplateFavoriteAction } from '@core/templates/actions/ToggleTemplateFavoriteAction';
import { RecordTemplateUseAction, RECENT_VISIBLE_COUNT } from '@core/templates/actions/RecordTemplateUseAction';
import { TemplateFavoritesHydrator } from '@core/templates/services/TemplateFavoritesHydrator';
import { TagConditionParser } from '@tscaps/engine';
import { BoxEdgesShorthandParser } from '@core/templates/services/BoxEdgesShorthandParser';
import { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';
import { CssAssetReferenceResolver } from '@core/templates/services/CssAssetReferenceResolver';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { StyleControlResolver } from '@core/templates/services/controls/StyleControlResolver';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import { TemplateSerializer } from '@core/templates/services/TemplateSerializer';
import { TemplateRecordMigrator } from '@core/templates/services/TemplateRecordMigrator';
import { BehindActorTemplateConfigSerializer } from '@core/person-segmentation/services/BehindActorTemplateConfigSerializer';
import { TypographyConfigSerializer } from '@core/sheets/services/TypographyConfigSerializer';
import type { EngineModule } from '@bootstrap/wiring/engine';

export interface TemplatesDependencies {
  readonly localStorageClient: LocalStorageClient;
  readonly indexedDb: IndexedDbClient;
  readonly engine: EngineModule;
}

export type TemplatesModule = Awaited<ReturnType<typeof bootTemplates>>;

/**
 * Boots the templates feature: loads the built-in templates, hydrates
 * the observable library store from the IndexedDB favorites
 * repository, and returns the asset-resolution services other modules
 * reuse to serialise or load templates from any source.
 */
export async function bootTemplates(deps: TemplatesDependencies) {
  const cssAssetReferenceResolver = new CssAssetReferenceResolver(BUILTIN_ASSETS);
  const repository = await loadBuiltinTemplates(deps.engine, cssAssetReferenceResolver);
  const favoritesRepository = buildFavoritesRepository(deps);
  const usageRepository = new LocalStorageTemplateUsageRepository(deps.localStorageClient);
  const library = new TemplateLibraryStore({
    favorites: new Set(),
    recent: usageRepository.recent().slice(0, RECENT_VISIBLE_COUNT),
  });
  const favoritesHydrator = new TemplateFavoritesHydrator(favoritesRepository, library);
  return {
    library,
    repository,
    cssAssetReferenceResolver,
    serializer: new TemplateSerializer(
      cssAssetReferenceResolver,
      deps.engine.svgFilterDefinitionsParser,
      new TemplateRecordMigrator(new StoredFontStackReader(new FontStackLibrary())),
      new BehindActorTemplateConfigSerializer(new TagConditionParser()),
      new TypographyConfigSerializer(),
    ),
    builtinAssetRepository: BUILTIN_ASSETS,
    favoritesHydrator,
    actions: {
      toggleFavorite: new ToggleTemplateFavoriteAction(library, favoritesRepository),
      recordUse: new RecordTemplateUseAction(library, usageRepository),
    },
  };
}

function buildFavoritesRepository(deps: TemplatesDependencies): TemplateFavoritesRepository {
  return new IndexedDbTemplateFavoritesRepository(deps.indexedDb);
}

async function loadBuiltinTemplates(
  engine: EngineModule,
  cssAssetReferenceResolver: CssAssetReferenceResolver,
): Promise<BuiltinTemplateRepository> {
  const fontStackLibrary = new FontStackLibrary();
  const styleControlResolver = new StyleControlResolver(new StyleControlCatalog(new SimilarNameFinder()), fontStackLibrary);
  const templateLoader = new LocalFileTemplateLoader(
    BUILTIN_TEMPLATE_ASSETS,
    cssAssetReferenceResolver,
    engine.segmentSplitters,
    engine.lineSplitters,
    engine.effects,
    engine.svgFilterDefinitionsParser,
    new BoxEdgesShorthandParser(),
    new TagConditionParser(),
    styleControlResolver,
    fontStackLibrary,
    new CalendarDateParser(),
  );
  const templates = await Promise.all(BUILTIN_TEMPLATE_NAMES.map((name) => templateLoader.load(name)));
  return new BuiltinTemplateRepository(templates);
}

/**
 * Returns the template-favorites-store schema for the shared
 * IndexedDB connection. Registered with the shared client at
 * bootstrap so the store exists before the first read or write.
 */
export function buildTemplateFavoritesIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return {
    name: 'template-favorites',
    keyPath: 'id',
  };
}
