import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeController } from '@presentation/theme/controllers/ThemeController';
import { KeyboardShortcutsController } from '@presentation/editor/controllers/KeyboardShortcutsController';
import { ProjectsHost } from '@ui/pages/editor/features/projects/ProjectsHost';
import { NewProjectRoute } from '@ui/pages/editor/NewProjectRoute';
import { ProjectRoute } from '@ui/pages/editor/ProjectRoute';
import { EditorAppProviders } from '@bootstrap/editor/EditorAppProviders';
import { ThemeProvider } from '@bootstrap/ThemeContext';
import type { AppModules } from '@bootstrap/AppModules';

interface EditorAppProps {
  modules: AppModules;
}

/**
 * Renders the editor tree: wraps the routes in `EditorAppProviders`
 * (every per-feature module context) and `ThemeProvider`. Owns the
 * lifetime of the editor-tree-wide presentation collaborators (theme
 * controller, global keyboard shortcuts).
 */
export function EditorApp({
  modules,
}: EditorAppProps) {
  const theme = useMemo(() => new ThemeController(), []);
  const keyboard = useMemo(
    () => new KeyboardShortcutsController(modules.editor.store),
    [modules.editor.store],
  );

  useEffect(() => {
    keyboard.start();
    return () => keyboard.stop();
  }, [keyboard]);


  const routes = modules.routing.routes;
  const projectsHost = <ProjectsHost />;

  return (
    <EditorAppProviders modules={modules}>
      <ThemeProvider value={theme}>
            <BrowserRouter>
              <Routes>
                <Route path={routes.projectsList()} element={projectsHost} />
                <Route path={routes.editor()} element={<NewProjectRoute />} />
                <Route path={routes.projectPattern()} element={<ProjectRoute />} />
                <Route path="*" element={<Navigate to={routes.projectsList()} replace />} />
              </Routes>
            </BrowserRouter>
      </ThemeProvider>
    </EditorAppProviders>
  );
}
