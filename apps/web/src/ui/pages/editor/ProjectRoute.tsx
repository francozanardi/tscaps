import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { EditorState } from '@core/editor/domain/EditorState';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useAppRoutes } from '@ui/_shared/hooks/useAppRoutes';
import { EditorShellHost } from '@ui/pages/editor/EditorShellHost';
import { VideoRecoveryPrompt } from '@ui/pages/editor/components/VideoRecoveryPrompt';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { UnsupportedTemplateDialog } from '@ui/pages/editor/components/dialogs/UnsupportedTemplateDialog';

interface LoadedInfo {
  videoFileName: string;
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

  useEffect(() => {
    const update = () => setSnapshot(store.snapshot());
    store.addEventListener('change', update);
    return () => store.removeEventListener('change', update);
  }, [store]);

  // Async project load orchestrated through status transitions; the effect
  // is the load lifecycle.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const current = store.snapshot();
    if (current.projectId === id && current.video.file) {
      setStatus({ kind: 'loaded', info: { videoFileName: current.video.file.name, substitutedTemplateIds: [] } });
      return;
    }
    setStatus({ kind: 'loading' });
    projects.actions.load.execute(id)
      .then((result) => {
        if (cancelled) return;
        if (result.unsupportedTemplateIds.length > 0) {
          setStatus({ kind: 'unsupported-template', templateIds: result.unsupportedTemplateIds });
          return;
        }
        setStatus({
          kind: 'loaded',
          info: {
            videoFileName: result.project.video.fileName,
            substitutedTemplateIds: result.substitutedTemplateIds,
          },
        });
      })
      .catch((err) => {
        console.error(`[projects] failed to open project "${id}":`, err);
        if (cancelled) return;
        setStatus({ kind: 'error' });
        navigate(routes.projectsList(), { replace: true });
      });
    return () => { cancelled = true; };
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
        <StatusPill label="Loading project" tone="info" active />
      </div>
    );
  }

  if (!snapshot.video.file) {
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
 * referenced a template the catalog no longer carries. The substitution
 * has already been applied; the toast tells the user about it so the
 * unexpected visual change is not silent.
 */
function MissingTemplatesToast({ missingTemplateIds }: MissingTemplatesToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && missingTemplateIds.length > 0;
  const count = missingTemplateIds.length;
  const description = count === 1
    ? 'One sheet was switched to the default template.'
    : `${count} sheets were switched to the default template.`;
  return (
    <Toast
      open={open}
      position="top-center"
      tone="info"
      icon={<AlertTriangle size={16} strokeWidth={2.5} />}
      title="Some templates couldn't be loaded"
      description={description}
      onDismiss={() => setDismissed(true)}
    />
  );
}
