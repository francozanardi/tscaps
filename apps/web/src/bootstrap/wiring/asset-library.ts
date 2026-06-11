import type { AssetRepository } from '@core/templates/domain/AssetRepository';
import { CompositeAssetRepository } from '@core/templates/infrastructure/repositories/CompositeAssetRepository';
import { UserBlobAssetRepository } from '@core/templates/infrastructure/repositories/UserBlobAssetRepository';
import { AssetsStore } from '@core/templates/store/AssetsStore';
import type { TemplatesModule } from '@bootstrap/wiring/templates';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';

export interface AssetLibraryDependencies {
  readonly templates: TemplatesModule;
  readonly userBlobs: UserBlobsModule;
}

export interface AssetLibraryModule {
  readonly repository: AssetRepository;
  readonly store: AssetsStore;
}

/**
 * Boots the unified asset library: composes the built-in catalog and
 * the user-uploaded asset projection behind a single
 * `AssetRepository`, paired with an `AssetsStore` that emits
 * `'change'` whenever the underlying user-blob universe moves.
 */
export function bootAssetLibrary(deps: AssetLibraryDependencies): AssetLibraryModule {
  const userBlobAssetRepository = new UserBlobAssetRepository(
    deps.userBlobs.store,
    deps.userBlobs.urlResolver,
  );
  const repository = new CompositeAssetRepository([
    deps.templates.builtinAssetRepository,
    userBlobAssetRepository,
  ]);
  const store = new AssetsStore(repository, [deps.userBlobs.store]);
  return { repository, store };
}
