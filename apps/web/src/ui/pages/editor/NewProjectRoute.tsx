import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { EditorShellHost } from '@ui/pages/editor/EditorShellHost';

/**
 * Route for the editor's "no project yet" URL — used after the
 * dashboard's "New project" flow has patched a video into the store
 * but no Project record exists yet.
 *
 * Watches `state.projectId` and, the moment it becomes non-null (i.e.
 * TranscribeAction has run CreateProjectAction), redirects to the
 * canonical project URL. The redirect uses `replace` so the back
 * button skips the transient editor URL.
 *
 * If a user lands here directly (deep-link, manual URL entry) without
 * a video already loaded in the store, redirects to the dashboard —
 * the editor URL is not meant to be a long-lived URL.
 */
export function NewProjectRoute() {
  const { store } = useEditor();
  const navigate = useNavigate();
  const routes = useAppRoutes();

  useEffect(() => {
    const checkAndRedirect = () => {
      const snap = store.snapshot();
      if (snap.projectId) {
        navigate(routes.project(snap.projectId), { replace: true });
      }
    };
    checkAndRedirect();
    store.addEventListener('change', checkAndRedirect);
    return () => store.removeEventListener('change', checkAndRedirect);
  }, [store, navigate, routes]);

  useEffect(() => {
    if (!store.snapshot().video.file) {
      navigate(routes.projectsList(), { replace: true });
    }
  }, [store, navigate, routes]);

  const onBack = useCallback(() => navigate(routes.projectsList()), [navigate, routes]);

  return <EditorShellHost onBack={onBack} />;
}
