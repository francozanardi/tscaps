import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import { IndexedDbUserBlobRepository } from '@core/user-blobs/infrastructure/IndexedDbUserBlobRepository';
import type { UserBlobKind } from '@core/user-blobs/domain/UserBlob';
import type { UserBlobRepository } from '@core/user-blobs/domain/UserBlobRepository';
import { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';
import { UserBlobsStore } from '@core/user-blobs/store/UserBlobsStore';
import { UploadUserBlobAction } from '@core/user-blobs/actions/UploadUserBlobAction';
import { DeleteUserBlobAction } from '@core/user-blobs/actions/DeleteUserBlobAction';


export interface UserBlobsDependencies {
  readonly indexedDb: IndexedDbClient;
}

export type UserBlobsModule = Awaited<ReturnType<typeof bootUserBlobs>>;

/**
 * Boots the user-blobs feature: the persistence-backed url resolver
 * the editor consults whenever a style control points at a blob the
 * user uploaded, plus the observable store the asset-library UI
 * subscribes to. Backed by IndexedDB.
 */
export async function bootUserBlobs(deps: UserBlobsDependencies) {
  const repository = buildRepository(deps);
  const store = new UserBlobsStore([]);
  const urlResolver = new UserBlobUrlResolver(repository, store);
  await urlResolver.boot();
  return {
    repository,
    urlResolver,
    store,
    capByKind: { 'template-asset': null, font: null } as Readonly<Record<UserBlobKind, number | null>>,
    actions: {
      upload: new UploadUserBlobAction(urlResolver),
      delete: new DeleteUserBlobAction(urlResolver),
    },
  };
}


function buildRepository(deps: UserBlobsDependencies): UserBlobRepository {
  return new IndexedDbUserBlobRepository(deps.indexedDb);
}

/**
 * Returns the user-blobs store schema for the shared IndexedDB
 * connection. Called by the composition root before `bootUtils` so
 * the shared client knows about every store at open time.
 */
export function buildUserBlobsIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return {
    name: 'user-blobs',
    keyPath: 'id',
  };
}
