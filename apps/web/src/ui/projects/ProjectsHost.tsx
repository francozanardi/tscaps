import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { useTheme } from '@bootstrap/ThemeContext';
import { ProjectsListPage } from '@ui/projects/components/ProjectsListPage';

/**
 * Renders the projects list backed by IndexedDB. Offers import /
 * export of `.tscaps` files so projects can move between devices.
 */
export function ProjectsHost() {
  const navigate = useNavigate();
  const projects = useProjects();
  const editor = useEditor();
  const theme = useTheme();
  const routes = useAppRoutes();
  const [mine, setMine] = useState<ProjectMetadata[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await projects.actions.list.execute();
      setMine(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list projects');
    }
  }, [projects]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refresh();
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleNewProject = useCallback((file: File) => {
    editor.actions.video.load.execute(file);
    navigate(routes.editor());
  }, [editor, navigate, routes]);

  const handleOpenProject = useCallback((id: string) => {
    navigate(routes.project(id));
  }, [navigate, routes]);

  const handleDeleteProject = useCallback(async (id: string) => {
    setError(null);
    try {
      await projects.actions.delete.execute(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  }, [projects, refresh]);

  const handleExportProject = useCallback(async (id: string) => {
    setError(null);
    try {
      await projects.actions.export.execute(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export project');
    }
  }, [projects]);

  const handleImportProject = useCallback(async (file: File) => {
    setError(null);
    try {
      const newId = await projects.actions.import.execute(file);
      await refresh();
      navigate(routes.project(newId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import project');
    }
  }, [projects, refresh, navigate, routes]);

  return (
    <ProjectsListPage
      projects={mine}
      isLoading={mine === null}
      error={error}
      title="Local projects"
      subtitle={(n) => n === 1 ? '1 project · stored in this browser' : `${n} projects · stored in this browser`}
      emptyTitle="Make your first project."
      emptyBody='Drop a video on the "New project" button above. Everything stays in this browser — export a .tscaps file to back up or move between devices.'
      onNewProject={handleNewProject}
      onOpenProject={handleOpenProject}
      onDeleteProject={handleDeleteProject}
      onExportProject={handleExportProject}
      onImportProject={handleImportProject}
      theme={theme}
    />
  );
}
