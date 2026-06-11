import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { UserBlob, UserBlobKind } from '@core/user-blobs/domain/UserBlob';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';
import type { UploadUserBlobResult } from '@core/user-blobs/actions/UploadUserBlobAction';
import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';

/**
 * UI-facing handle for the user-uploaded blobs feature: the live list
 * (subscribed via `useSyncExternalStore`), the URL resolver the
 * overlay consults, and the upload/delete callbacks the asset
 * library invokes. Composition root owns the module and feeds it
 * through this context — components consume via `useUserBlobs()`.
 */
export interface UserBlobsContextValue {
  blobs: readonly UserBlob[];
  urlResolver: UserBlobUrlResolver;
  /** Server-enforced count cap per kind; `null` for kinds without cap on this surface. */
  capByKind: Readonly<Record<UserBlobKind, number | null>>;
  upload: (file: File) => Promise<UploadUserBlobResult>;
  delete: (id: string) => Promise<void>;
}

const UserBlobsContext = createContext<UserBlobsContextValue | null>(null);

interface UserBlobsProviderProps {
  value: UserBlobsModule;
  children: ReactNode;
}

export function UserBlobsProvider({ value, children }: UserBlobsProviderProps) {
  const blobs = useSyncExternalStore(
    (cb) => {
      value.store.addEventListener('change', cb);
      return () => value.store.removeEventListener('change', cb);
    },
    () => value.store.snapshot(),
  );
  return (
    <UserBlobsContext.Provider
      value={{
        blobs,
        urlResolver: value.urlResolver,
        capByKind: value.capByKind,
        upload: (file) => value.actions.upload.execute(file),
        delete: (id) => value.actions.delete.execute(id),
      }}
    >
      {children}
    </UserBlobsContext.Provider>
  );
}

/**
 * Returns the user-blobs context. Throws if the consumer is mounted
 * outside `<UserBlobsProvider>`; that is always a wiring bug and
 * should surface loudly rather than fall back to a stale or partial
 * surface.
 */
export function useUserBlobs(): UserBlobsContextValue {
  const value = useContext(UserBlobsContext);
  if (!value) throw new Error('useUserBlobs must be used inside <UserBlobsProvider>');
  return value;
}
