import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Asset } from '@core/templates/domain/Asset';
import type { AssetRepository } from '@core/templates/domain/AssetRepository';
import type { AssetLibraryModule } from '@bootstrap/wiring/asset-library';

/**
 * UI-facing handle for the unified asset library: the live list
 * (subscribed via `useSyncExternalStore`) and the synchronous
 * resolver for single-id lookups. Composition root owns the module
 * and feeds it through this context.
 */
export interface AssetLibraryContextValue {
  assets: readonly Asset[];
  repository: AssetRepository;
}

const AssetLibraryContext = createContext<AssetLibraryContextValue | null>(null);

interface AssetLibraryProviderProps {
  value: AssetLibraryModule;
  children: ReactNode;
}

export function AssetLibraryProvider({ value, children }: AssetLibraryProviderProps) {
  const assets = useSyncExternalStore(
    (cb) => {
      value.store.addEventListener('change', cb);
      return () => value.store.removeEventListener('change', cb);
    },
    () => value.store.snapshot(),
  );
  return (
    <AssetLibraryContext.Provider value={{ assets, repository: value.repository }}>
      {children}
    </AssetLibraryContext.Provider>
  );
}

/**
 * Returns the asset-library context. Throws if the consumer is mounted
 * outside `<AssetLibraryProvider>`; that is always a wiring bug and
 * should surface loudly rather than fall back to a stale or partial
 * surface.
 */
export function useAssetLibrary(): AssetLibraryContextValue {
  const value = useContext(AssetLibraryContext);
  if (!value) throw new Error('useAssetLibrary must be used inside <AssetLibraryProvider>');
  return value;
}
