import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';
import { ScreenWakeLock } from '@presentation/editor/controllers/ScreenWakeLock';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { EditorShellHost } from '@ui/pages/editor/EditorShellHost';
import { VideoRecoveryPrompt } from '@ui/pages/editor/components/VideoRecoveryPrompt';
import { ProjectLoadingIndicator } from '@ui/pages/editor/components/ProjectLoadingIndicator';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { UnsupportedTemplateDialog } from '@ui/pages/editor/components/dialogs/UnsupportedTemplateDialog';

interface LoadedInfo {
  videoFileName: string;
  videoRecovered: boolean;
  substitutedTemplateIds: ReadonlyArray<string>;
}

type LoadStatus =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'unsupported-template'; templateIds: ReadonlyArray<string> }
  | { kind: 'loaded'; info: LoadedInfo };

/**
 * Route for "/project/:id" — hydrates the editor from a persisted Project.
 *
 * Skips the load if the store is already on the requested project (e.g. the
 * user just got redirected here from `/editor` after CreateProjectAction —
 * the state is in memory and re-loading from IndexedDB would be wasteful).
 *
 * Three render states:
 *  - loading: brief blank while LoadProjectAction is in flight
 *  - error: the project does not exist or could not be loaded → kicks the
 *    user back to the dashboard
 *  - loaded: either renders the EditorHost (if a video is attached) or
 *    a VideoRecoveryPrompt (if the cached blob was evicted)
 */
export function ProjectRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projects = useProjects();
  const { store } = useEditor();
  const routes = useAppRoutes();
  const onBack = useCallback(() => navigate(routes.projectsList()), [navigate, routes]);
  const [status, setStatus] = useState<LoadStatus>({ kind: 'loading' });
  const [snapshot, setSnapshot] = useState<EditorState>(() => store.snapshot());
  const [downloadStatus, setDownloadStatus] = useState<OriginalVideoDownloadStatus>(
    () => projects.originalVideoDownloadStore.status,
  );

  useEffect(() => {
    const update = () => setSnapshot(store.snapshot());
    store.addEventListener('change', update);
    return () => store.removeEventListener('change', update);
  }, [store]);

  useEffect(() => {
    const store = projects.originalVideoDownloadStore;
    const update = () => setDownloadStatus(store.status);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [projects]);

  useEffect(() => {
    if (status.kind !== 'loading') return;
    const wakeLock = new ScreenWakeLock();
    wakeLock.start();
    return () => wakeLock.stop();
  }, [status.kind]);

  // Async project load orchestrated through status transitions; the effect
  // is the load lifecycle. The controller aborts the in-flight fetch and
  // background download when the route unmounts, so a stale load cannot
  // stomp the next project's state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!id) return;
    const current = store.snapshot();
    if (current.projectId === id && current.video.fileName) {
      setStatus({
        kind: 'loaded',
        info: {
          videoFileName: current.video.fileName,
          videoRecovered: true,
          substitutedTemplateIds: [],
        },
      });
      return;
    }
    const controller = new AbortController();
    setStatus({ kind: 'loading' });
    projects.actions.load.execute(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.unsupportedTemplateIds.length > 0) {
          setStatus({ kind: 'unsupported-template', templateIds: result.unsupportedTemplateIds });
          return;
        }
        setStatus({
          kind: 'loaded',
          info: {
            videoFileName: result.project.video.fileName,
            videoRecovered: result.videoRecovered,
            substitutedTemplateIds: result.substitutedTemplateIds,
          },
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(`[projects] failed to open project "${id}":`, err);
        setStatus({ kind: 'error' });
        navigate(routes.projectsList(), { replace: true });
      });
    return () => { controller.abort(); };
  }, [id, store, projects, navigate, routes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (status.kind === 'unsupported-template') {
    return (
      <UnsupportedTemplateDialog
        open
        templateIds={status.templateIds}
        onDismiss={() => navigate(routes.projectsList(), { replace: true })}
      />
    );
  }

  if (status.kind !== 'loaded') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <ProjectLoadingIndicator downloadStatus={downloadStatus} />
      </div>
    );
  }

  if (!status.info.videoRecovered) {
    return (
      <>
        <VideoRecoveryPrompt
          projectName={snapshot.projectName}
          videoFileName={status.info.videoFileName}
          onSelect={(file) => { void projects.actions.recoverVideo.execute(file); }}
          onCancel={() => navigate(routes.projectsList(), { replace: true })}
        />
        <MissingTemplatesToast missingTemplateIds={status.info.substitutedTemplateIds} />
      </>
    );
  }

  return (
    <>
      <EditorShellHost onBack={onBack} />
      <MissingTemplatesToast missingTemplateIds={status.info.substitutedTemplateIds} />
    </>
  );
}

interface MissingTemplatesToastProps {
  readonly missingTemplateIds: ReadonlyArray<string>;
}

/**
 * Notice surfaced after the load completes when one or more sheets
 * referenced a template the session cannot apply — either because
 * the catalog no longer carries it or because a capability filter
 * (browser codec support, preview surface variant) excluded it. The
 * substitution has already been applied; the toast tells the user
 * about it so the unexpected visual change is not silent.
 */
function MissingTemplatesToast({ missingTemplateIds }: MissingTemplatesToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && missingTemplateIds.length > 0;
  const count = missingTemplateIds.length;
  const description = count === 1
    ? 'One sheet was switched to a template your device supports.'
    : `${count} sheets were switched to a template your device supports.`;
  return (
    <Toast
      open={open}
      position="top-center"
      tone="info"
      icon={<AlertTriangle size={16} strokeWidth={2.5} />}
      title="Some templates couldn't be applied"
      description={description}
      onDismiss={() => setDismissed(true)}
    />
  );
}
