import { useCallback, useEffect } from 'react';
import { useHref, useNavigate } from 'react-router-dom';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { useAppExit } from '@bootstrap/AppExitContext';
import { useStartFlowChoosesVideo } from '@bootstrap/StartFlowChoosesVideoContext';
import { EditorShellHost } from '@ui/pages/editor/EditorShellHost';

/**
 * Route for the editor's "no project yet" URL — used after the
 * dashboard's "New project" flow has patched a video into the store
 * but no Project record exists yet.
 *
 * Watches `state.projectId` and, the moment it becomes non-null (the
 * preprocessing run established its project), redirects to the
 * canonical project URL. The redirect uses `replace` so the back
 * button skips the transient editor URL. It only happens while the
 * browser is still at this route's URL: a reader who already went back
 * stays where they went, even if the id arrives before this route has
 * unmounted.
 *
 * If a user lands here directly (deep-link, manual URL entry) without
 * a video already loaded in the store, leaves for the dashboard — or
 * out of the app, when the tree has no workspace. The editor URL is
 * not meant to be a long-lived URL. The exception is a start flow
 * that asks for the video itself: there, arriving without one is the
 * reason the flow is open.
 */
export function NewProjectRoute() {
  const { store } = useEditor();
  const navigate = useNavigate();
  const routes = useAppRoutes();
  const exitHref = useAppExit();
  const { e2eMode, automationSession } = useUtils();
  const startFlowChoosesVideo = useStartFlowChoosesVideo();

  const leaveEditor = useCallback((replaceEntry: boolean) => {
    if (exitHref !== null) {
      window.location.replace(exitHref);
      return;
    }
    navigate(routes.projectsList(), { replace: replaceEntry });
  }, [exitHref, navigate, routes]);

  const editorPath = useHref(routes.editor());
  useEffect(() => {
    const checkAndRedirect = () => {
      // The URL changes the moment the reader navigates away, and this
      // route unmounts only once the next one renders. A redirect in
      // between would replace the page they went to.
      if (window.location.pathname !== editorPath) return;
      const snap = store.snapshot();
      if (snap.projectId) {
        navigate(routes.project(snap.projectId), { replace: true });
      }
    };
    checkAndRedirect();
    store.addEventListener('change', checkAndRedirect);
    return () => store.removeEventListener('change', checkAndRedirect);
  }, [store, navigate, routes, editorPath]);

  useEffect(() => {
    // The e2e hook, and a program driving the page through the automation
    // bridge, load the video after the page has booted, so the "no video"
    // guard would fire before it arrives. Both drive the state directly.
    if (e2eMode.isEnabled() || automationSession.token() !== null) return;
    if (startFlowChoosesVideo) return;
    if (!store.snapshot().video.file) leaveEditor(true);
  }, [store, e2eMode, automationSession, startFlowChoosesVideo, leaveEditor]);

  const onBack = useCallback(() => leaveEditor(false), [leaveEditor]);

  return <EditorShellHost onBack={onBack} />;
}
