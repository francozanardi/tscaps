import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { useAppExit } from '@bootstrap/AppExitContext';
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
 * a video already loaded in the store, leaves for the dashboard — or
 * out of the app, when the tree has no workspace. The editor URL is
 * not meant to be a long-lived URL.
 */
export function NewProjectRoute() {
  const { store } = useEditor();
  const navigate = useNavigate();
  const routes = useAppRoutes();
  const exitHref = useAppExit();
  const { e2eMode } = useUtils();

  const leaveEditor = useCallback((replaceEntry: boolean) => {
    if (exitHref !== null) {
      window.location.replace(exitHref);
      return;
    }
    navigate(routes.projectsList(), { replace: replaceEntry });
  }, [exitHref, navigate, routes]);

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
    // so the "no video" guard would fire before the fixture arrives.
    // Skip it in e2e mode; the hook drives the state directly.
    if (e2eMode.isEnabled()) return;
    if (!store.snapshot().video.file) leaveEditor(true);
  }, [store, e2eMode, leaveEditor]);

  const onBack = useCallback(() => leaveEditor(false), [leaveEditor]);

  return <EditorShellHost onBack={onBack} />;
}
