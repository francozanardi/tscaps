import { createContext, useContext, type ReactNode } from 'react';
import type { SubjectTrackingModule } from '@bootstrap/wiring/subject-tracking';

const SubjectTrackingContext = createContext<SubjectTrackingModule | null>(null);

interface SubjectTrackingProviderProps {
  value: SubjectTrackingModule;
  children: ReactNode;
}

export function SubjectTrackingProvider({ value, children }: SubjectTrackingProviderProps) {
  return <SubjectTrackingContext.Provider value={value}>{children}</SubjectTrackingContext.Provider>;
}

/**
 * Returns the subject-tracking module: finding the people in frames of
 * the video and following one of them. Throws if the consumer is mounted
 * outside `<SubjectTrackingProvider>`; that is always a wiring bug.
 */
export function useSubjectTracking(): SubjectTrackingModule {
  const value = useContext(SubjectTrackingContext);
  if (!value) throw new Error('useSubjectTracking must be used inside <SubjectTrackingProvider>');
  return value;
}
