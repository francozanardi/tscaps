import { useEffect, useMemo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeController } from '@presentation/theme/controllers/ThemeController';
import { KeyboardShortcutsController } from '@presentation/editor/controllers/KeyboardShortcutsController';
import { EditorWorkspaceStore } from '@presentation/editor/stores/EditorWorkspaceStore';
import { CaptionsTabStore } from '@presentation/editor/stores/CaptionsTabStore';
import { EditorWorkspaceStoreProvider } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { CaptionsTabStoreProvider } from '@ui/pages/editor/contexts/CaptionsTabContext';
import { ProjectsHost } from '@ui/pages/editor/features/projects/ProjectsHost';
import { NewProjectRoute } from '@ui/pages/editor/NewProjectRoute';
import { ProjectRoute } from '@ui/pages/editor/ProjectRoute';
import { EditorAppProviders } from '@bootstrap/editor/EditorAppProviders';
import { ThemeProvider } from '@bootstrap/ThemeContext';
import { StartFlowSlotProvider } from '@bootstrap/StartFlowSlotContext';
import { AppExitProvider } from '@bootstrap/AppExitContext';
import { AppExitRedirect } from '@ui/_shared/components/AppExitRedirect';
import { PostExportPromptSlotProvider, type PostExportPromptRenderer } from '@bootstrap/PostExportPromptSlotContext';
import type { AppModules } from '@bootstrap/AppModules';

interface EditorAppProps {
  modules: AppModules;
  startFlow: ReactNode | null;
  postExportPrompt: PostExportPromptRenderer | null;
  /** URL the app leaves to; `null` mounts the project workspace instead. */
  exitHref: string | null;
}

/**
 * Renders the editor tree: wraps the routes in `EditorAppProviders`
 * (every per-feature module context) and `ThemeProvider`. Owns the
 * lifetime of the editor-tree-wide presentation collaborators (theme
 * controller, global keyboard shortcuts).
 */
export function EditorApp({
  modules,
  startFlow,
  postExportPrompt,
  exitHref,
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

  const workspaceStore = useMemo(() => new EditorWorkspaceStore(), []);
  const captionsTabStore = useMemo(() => new CaptionsTabStore(), []);


  const routes = modules.routing.routes;
  const projectsHost = <ProjectsHost />;

  return (
    <EditorAppProviders modules={modules}>
      <AppExitProvider value={exitHref}>
      <StartFlowSlotProvider value={startFlow}>
      <PostExportPromptSlotProvider value={postExportPrompt}>
      <ThemeProvider value={theme}>
      <EditorWorkspaceStoreProvider value={workspaceStore}>
      <CaptionsTabStoreProvider value={captionsTabStore}>
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              {/* The shell is exactly one screen tall and the route pane
                  is the app's only scroll container, so a strip above it
                  takes real space instead of covering the page it warns
                  about. Route subtrees size against the pane (`h-full`),
                  never against the viewport. */}
              <div className="flex flex-col h-dvh">
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Routes>
                    {exitHref === null && <Route path={routes.projectsList()} element={projectsHost} />}
                    <Route path={routes.editor()} element={<NewProjectRoute />} />
                    <Route path={routes.toolPattern()} element={<NewProjectRoute />} />
                    {exitHref === null && <Route path={routes.projectPattern()} element={<ProjectRoute />} />}
                    <Route
                      path="*"
                      element={exitHref === null
                        ? <Navigate to={routes.projectsList()} replace />
                        : <AppExitRedirect href={exitHref} />}
                    />
                  </Routes>
                </div>
              </div>
            </BrowserRouter>
      </CaptionsTabStoreProvider>
      </EditorWorkspaceStoreProvider>
      </ThemeProvider>
      </PostExportPromptSlotProvider>
      </StartFlowSlotProvider>
      </AppExitProvider>
    </EditorAppProviders>
  );
}
