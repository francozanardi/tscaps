import { useCallback, useEffect, useState } from 'react';
import { useHref, useNavigate } from 'react-router-dom';
import type { AppError } from '@core/errors/domain/AppError';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import { ProjectListLoadFailedError } from '@core/projects/domain/errors/ProjectListLoadFailedError';
import { ProjectDeleteFailedError } from '@core/projects/domain/errors/ProjectDeleteFailedError';
import { ProjectExportFailedError } from '@core/projects/domain/errors/ProjectExportFailedError';
import { ProjectImportFailedError } from '@core/projects/domain/errors/ProjectImportFailedError';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { useVideos } from '@ui/_shared/contexts/modules/VideosContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import { useTheme } from '@bootstrap/ThemeContext';
import {
  ProjectsListPage,
  type ProjectInProgressListing,
} from '@ui/pages/editor/features/projects/components/ProjectsListPage';
import { useProjectListing } from '@ui/pages/editor/features/projects/hooks/useProjectListing';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import type { ProjectInProgress } from '@presentation/projects/services/ProjectListingBuilder';
import { ProjectInProgressLabel } from '@presentation/projects/services/ProjectInProgressLabel';

const PROJECT_IN_PROGRESS_LABEL = new ProjectInProgressLabel();

/**
 * Renders the projects list backed by IndexedDB, finished or
 * unfinished, and shows the ones runs in this tab are still working on
 * with the stage their run is in. Offers import / export of `.tscaps`
 * files so projects can move between devices. The list is read again
 * whenever a run ends.
 */
export function ProjectsHost() {
  const navigate = useNavigate();
  const projects = useProjects();
  const { runsStore } = usePreprocessing();
  const videos = useVideos();
  const theme = useTheme();
  const routes = useAppRoutes();
  const homeHref = useHref(routes.projectsList());
  const [mine, setMine] = useState<ProjectMetadata[] | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const isMobile = useIsMobileViewport();

  const refresh = useCallback(async () => {
    try {
      const all = await projects.actions.list.execute();
      setMine(all);
    } catch (cause) {
      setError(new ProjectListLoadFailedError({ cause }));
    }
  }, [projects]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refresh();
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // A run that ends has stored its project, finished or unfinished, or
  // given it up: either way the stored list is the one to show for it
  // now.
  useEffect(() => {
    const refreshOnRunChange = () => { void refresh(); };
    runsStore.addEventListener('change', refreshOnRunChange);
    return () => runsStore.removeEventListener('change', refreshOnRunChange);
  }, [runsStore, refresh]);

  const listing = useProjectListing(mine);

  const handleNewProject = useCallback((file: File) => {
    videos.actions.load.execute(file);
    navigate(routes.editor());
  }, [videos, navigate, routes]);

  const handleOpenProject = useCallback((id: string) => {
    navigate(routes.project(id));
  }, [navigate, routes]);

  const handleDeleteProject = useCallback(async (id: string) => {
    setError(null);
    try {
      await projects.actions.delete.execute(id);
      await refresh();
    } catch (cause) {
      setError(new ProjectDeleteFailedError({ cause }));
    }
  }, [projects, refresh]);

  const handleExportProject = useCallback(async (id: string) => {
    setError(null);
    try {
      await projects.actions.export.execute(id);
    } catch (cause) {
      setError(new ProjectExportFailedError({ cause }));
    }
  }, [projects]);

  const handleImportProject = useCallback(async (file: File) => {
    setError(null);
    try {
      const newId = await projects.actions.import.execute(file);
      await refresh();
      navigate(routes.project(newId));
    } catch (cause) {
      setError(new ProjectImportFailedError({ cause }));
    }
  }, [projects, refresh, navigate, routes]);

  return (
    <>
    <ProjectsListPage
      projects={listing?.stored ?? null}
      projectsInProgress={(listing?.inProgress ?? []).map(toInProgressListing)}
      isLoading={mine === null}
      error={error}
      isMobileDevice={isMobile}
      homeHref={homeHref}
      title="Local projects"
      subtitle={(n) => n === 1 ? '1 project · stored in this browser' : `${n} projects · stored in this browser`}
      emptyTitle="Make your first project."
      emptyBody="Drop a video anywhere on this page. Everything stays in this browser. Export a .tscaps file to back up or move between devices."
      onNewProject={handleNewProject}
      onOpenProject={handleOpenProject}
      onDeleteProject={handleDeleteProject}
      onExportProject={handleExportProject}
      onImportProject={handleImportProject}
      theme={theme}
    />
    </>
  );
}

function toInProgressListing(entry: ProjectInProgress): ProjectInProgressListing {
  return {
    project: entry.project,
    openable: entry.openable,
    status: <StatusPill label={PROJECT_IN_PROGRESS_LABEL.of(entry.progress)} tone="info" active />,
  };
}
