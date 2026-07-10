import { createContext, useContext, type ReactNode } from 'react';
import type { PersonSegmentationModule } from '@bootstrap/wiring/person-segmentation';

const PersonSegmentationContext = createContext<PersonSegmentationModule | null>(null);

interface PersonSegmentationProviderProps {
  value: PersonSegmentationModule;
  children: ReactNode;
}

export function PersonSegmentationProvider({ value, children }: PersonSegmentationProviderProps) {
  return <PersonSegmentationContext.Provider value={value}>{children}</PersonSegmentationContext.Provider>;
}

/**
 * Returns the person-segmentation module — the flow / progress
 * stores, cache repository, and actions the prepare-video dialog
 * consumes. Throws if the consumer is mounted outside
 * `<PersonSegmentationProvider>`; that is always a wiring bug.
 */
export function usePersonSegmentation(): PersonSegmentationModule {
  const value = useContext(PersonSegmentationContext);
  if (!value) throw new Error('usePersonSegmentation must be used inside <PersonSegmentationProvider>');
  return value;
}
