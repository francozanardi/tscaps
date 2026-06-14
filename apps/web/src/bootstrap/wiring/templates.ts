import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
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
import { BoxEdgesShorthandParser } from '@core/templates/services/BoxEdgesShorthandParser';
import { SegmentPaddingCssRuleBuilder } from '@core/templates/services/SegmentPaddingCssRuleBuilder';
import { CssAssetReferenceResolver } from '@core/templates/services/CssAssetReferenceResolver';
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
  await favoritesHydrator.boot();
  return {
    library,
    repository,
    cssAssetReferenceResolver,
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
  const templateLoader = new LocalFileTemplateLoader(
    BUILTIN_TEMPLATE_ASSETS,
    cssAssetReferenceResolver,
    engine.segmentSplitters,
    engine.lineSplitters,
    engine.effects,
    engine.svgFilterDefinitionsParser,
    new BoxEdgesShorthandParser(),
    new SegmentPaddingCssRuleBuilder(),
  );
  const templates = await Promise.all(builtinTemplateNames().map((name) => templateLoader.load(name)));
  return new BuiltinTemplateRepository(templates);
}

function builtinTemplateNames(): string[] {
  return [
    'mira',
    'cleo',
    'noor',
    'tito',
    'pico',
    'pepper',
    'iris',
    'loki',
    'otto',
    'theo',
    'vera',
    'kel',
    'yuki',
    'naya',
    'elio',
    'anya',
    'juno',
    'zara',
    'tala',
    'remi',
    'ivo',
    'levi',
    'nyx',
    'lena',
    'lyra',
    'freya',
    'kai',
    'luna',
    'selene',
  ];
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
