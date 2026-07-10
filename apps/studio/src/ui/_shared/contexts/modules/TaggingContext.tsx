import { createContext, useContext, type ReactNode } from 'react';
import type { TaggingModule } from '@bootstrap/wiring/tagging';

const TaggingContext = createContext<TaggingModule | null>(null);

interface TaggingProviderProps {
  value: TaggingModule;
  children: ReactNode;
}

export function TaggingProvider({ value, children }: TaggingProviderProps) {
  return <TaggingContext.Provider value={value}>{children}</TaggingContext.Provider>;
}

/**
 * Returns the tagging module. Throws if the consumer is mounted
 * outside `<TaggingProvider>`; that is always a wiring bug and
 * should surface loudly rather than fall back to a stale or
 * partial surface.
 */
export function useTagging(): TaggingModule {
  const value = useContext(TaggingContext);
  if (!value) throw new Error('useTagging must be used inside <TaggingProvider>');
  return value;
}
