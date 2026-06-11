import type { IndexedDbClient } from '@core/_shared/persistence/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/persistence/IndexedDbStoreDefinition';
import { IndexedDbUserTemplateRepository } from '@core/user-templates/infrastructure/IndexedDbUserTemplateRepository';
import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import { UserSavedTemplateRepository } from '@core/user-templates/infrastructure/repositories/UserSavedTemplateRepository';
import { TemplateSerializer } from '@core/templates/services/TemplateSerializer';
import { TemplateRecordMigrator } from '@core/templates/services/TemplateRecordMigrator';
import { TemplateFromSheetBuilder } from '@core/user-templates/services/TemplateFromSheetBuilder';
import { UserTemplateLibraryHydrator } from '@core/user-templates/services/UserTemplateLibraryHydrator';
import { SaveUserTemplateAction } from '@core/user-templates/actions/SaveUserTemplateAction';
import { DeleteUserTemplateAction } from '@core/user-templates/actions/DeleteUserTemplateAction';
import { RenameUserTemplateAction } from '@core/user-templates/actions/RenameUserTemplateAction';
import { OverwriteUserTemplateAction } from '@core/user-templates/actions/OverwriteUserTemplateAction';
import { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';
import { UserTemplateNameValidator } from '@core/user-templates/services/UserTemplateNameValidator';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { TemplatesModule } from '@bootstrap/wiring/templates';
import type { EngineModule } from '@bootstrap/wiring/engine';

export interface UserTemplatesDependencies {
  readonly indexedDb: IndexedDbClient;
  readonly engine: EngineModule;
  readonly templates: TemplatesModule;
  readonly templateSupportChecker: TemplateBrowserSupportChecker;
}

export type UserTemplatesModule = Awaited<ReturnType<typeof bootUserTemplates>>;

/**
 * Boots the user-templates feature. Hydrates the observable library
 * from the IndexedDB repository and wires every CRUD action plus the
 * rename / overwrite variants. Returns the hydrator alongside the
 * store so project-lifecycle coordinators can refresh the library
 * whenever they need to.
 */
export async function bootUserTemplates(deps: UserTemplatesDependencies) {
  const templateSerializer = new TemplateSerializer(
    deps.templates.cssAssetReferenceResolver,
    deps.engine.svgFilterDefinitionsParser,
    new TemplateRecordMigrator(),
  );
  const repository = buildRepository(templateSerializer, deps);
  const templateRepository = new UserSavedTemplateRepository(repository);
  const store = new UserTemplatesStore([]);
  const libraryHydrator = new UserTemplateLibraryHydrator(repository, store);
  await libraryHydrator.boot();
  const templateFromSheetBuilder = new TemplateFromSheetBuilder(deps.engine.svgFilterDefinitionsParser);
  const nameValidator = new UserTemplateNameValidator();
  return {
    repository,
    templateRepository,
    store,
    libraryHydrator,
    nameValidator,
    templateSupportChecker: deps.templateSupportChecker,
    actions: {
      save: new SaveUserTemplateAction(repository, templateFromSheetBuilder, store, nameValidator),
      delete: new DeleteUserTemplateAction(repository, store),
      rename: new RenameUserTemplateAction(repository, store, nameValidator),
      overwrite: new OverwriteUserTemplateAction(repository, templateFromSheetBuilder, store),
    },
  };
}

function buildRepository(
  templateSerializer: TemplateSerializer,
  deps: UserTemplatesDependencies,
): UserTemplateRepository {
  return new IndexedDbUserTemplateRepository(deps.indexedDb, templateSerializer);
}

/**
 * Returns the user-templates store schema for the shared IndexedDB
 * connection. Registered with the shared client at bootstrap so the
 * store exists before the first read or write.
 */
export function buildUserTemplatesIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return {
    name: 'user-templates',
    keyPath: 'id',
  };
}
