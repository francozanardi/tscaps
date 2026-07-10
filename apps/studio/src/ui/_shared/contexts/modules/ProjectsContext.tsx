import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectsModule } from '@bootstrap/wiring/projects';

const ProjectsContext = createContext<ProjectsModule | null>(null);

interface ProjectsProviderProps {
  value: ProjectsModule;
  children: ReactNode;
}

export function ProjectsProvider({ value, children }: ProjectsProviderProps) {
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

/**
 * Returns the projects API. Throws if the consumer is mounted outside
 * `<ProjectsProvider>`; that is always a wiring bug and should surface
 * loudly rather than fall back to a stale or partial surface.
 */
export function useProjects(): ProjectsModule {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error('useProjects must be used inside <ProjectsProvider>');
  return value;
}
