import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FontUserBlob, UserBlob } from '@core/user-blobs/domain/UserBlob';
import type { UploadUserFontResult } from '@core/fonts/actions/UploadUserFontAction';
import { useUserBlobs } from '@ui/_shared/contexts/modules/UserBlobsContext';

/**
 * UI-facing handle for the user-uploaded fonts feature: the live
 * filtered list of font blobs plus the upload / delete callbacks the
 * picker invokes. The bridge subscribes to the shared user-blob
 * store, filters by font kind, and feeds the slice through this
 * context so font state stays in lockstep with the broader blob
 * store everything else reads.
 */
export interface UserFontsContextValue {
  fonts: readonly FontUserBlob[];
  upload: (file: File) => Promise<UploadUserFontResult>;
  delete: (id: string) => Promise<void>;
}

const UserFontsContext = createContext<UserFontsContextValue | null>(null);

interface UserFontsProviderProps {
  fonts: readonly FontUserBlob[];
  upload: (file: File) => Promise<UploadUserFontResult>;
  delete: (id: string) => Promise<void>;
  children: ReactNode;
}

export function UserFontsProvider({ fonts, upload, delete: deleteFn, children }: UserFontsProviderProps) {
  const value = useMemo<UserFontsContextValue>(
    () => ({ fonts, upload, delete: deleteFn }),
    [fonts, upload, deleteFn],
  );
  return (
    <UserFontsContext.Provider value={value}>
      {children}
    </UserFontsContext.Provider>
  );
}

interface UserFontsBridgeProps {
  upload: (file: File) => Promise<UploadUserFontResult>;
  delete: (id: string) => Promise<void>;
  children: ReactNode;
}

/**
 * Adapter that filters the shared user-blob store down to fonts and
 * publishes them through `UserFontsContext`. Lives next to the
 * provider so consumers can stay agnostic of the underlying
 * user-blobs plumbing. Must be mounted inside `<UserBlobsProvider>`.
 */
export function UserFontsBridge({ upload, delete: deleteFn, children }: UserFontsBridgeProps) {
  const userBlobs = useUserBlobs();
  const fonts = useMemo(
    () => userBlobs.blobs.filter(isFontBlob),
    [userBlobs.blobs],
  );
  return (
    <UserFontsProvider fonts={fonts} upload={upload} delete={deleteFn}>
      {children}
    </UserFontsProvider>
  );
}

function isFontBlob(blob: UserBlob): blob is FontUserBlob {
  return blob.kind === 'font';
}

export function useUserFonts(): UserFontsContextValue {
  const value = useContext(UserFontsContext);
  if (!value) throw new Error('useUserFonts must be used inside <UserFontsProvider>');
  return value;
}
