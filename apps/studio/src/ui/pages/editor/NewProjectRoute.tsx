import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
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
  const { e2eMode } = useUtils();

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
    // The e2e hook loads the video from the test after the page has booted,
    // so the "no video → dashboard" guard would kick in before the fixture
    // arrives. Skip it in e2e mode; the hook drives the state directly.
    if (e2eMode.isEnabled()) return;
    if (!store.snapshot().video.file) {
      navigate(routes.projectsList(), { replace: true });
    }
  }, [store, navigate, routes, e2eMode]);

  const onBack = useCallback(() => navigate(routes.projectsList()), [navigate, routes]);

  return <EditorShellHost onBack={onBack} />;
}
