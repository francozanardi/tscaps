import { memo, useEffect, useState } from 'react';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectThumbnailSource } from '@core/projects/domain/ProjectThumbnailSource';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { ProjectActionsMenu } from '@ui/pages/editor/features/projects/components/ProjectActionsMenu';

interface ProjectCardProps {
  project: ProjectMetadata;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  /** When omitted the export action is hidden. */
  onExport?: (id: string) => void;
}

const CARD =
  'group/card relative flex flex-col bg-surface-1 border border-edge-subtle rounded-sm overflow-hidden ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:border-edge-medium ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0';

const DURATION_BADGE =
  'absolute bottom-1.5 right-1.5 tabular-nums font-mono text-2xs text-white ' +
  'bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-xs';

export const ProjectCard = memo(function ProjectCard({ project, onOpen, onDelete, onExport }: ProjectCardProps) {
  const thumbUrl = useThumbnailRenderUrl(project.thumbnail);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const requestDelete = () => setConfirmOpen(true);
  const requestExport = () => { if (onExport) onExport(project.id); };

  return (
    <>
      <div
        className={CARD}
        onClick={() => onOpen(project.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(project.id); }}
      >
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {thumbUrl
            ? <img src={thumbUrl} alt="" className="w-full h-full object-cover block" />
            : <div className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-faint">No preview</div>
          }
          {project.video.duration > 0 && (
            <span className={DURATION_BADGE}>{formatDuration(project.video.duration)}</span>
          )}
        </div>
        <div className="px-3 pt-2.5 pb-2 flex flex-col gap-1 min-w-0">
          <div className="text-sm font-medium text-fg-primary truncate" title={project.name}>{project.name}</div>
          <div className="flex items-center gap-2 text-2xs text-fg-faint">
            <span className="tabular-nums flex-1 truncate">{formatDate(project.updatedAt)}</span>
            <div onClick={(e) => e.stopPropagation()}>
              <ProjectActionsMenu
                projectId={project.id}
                projectName={project.name}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                canExport={onExport !== undefined}
                onExport={requestExport}
                onDelete={requestDelete}
              />
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        message={`Delete "${project.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={() => { void handleConfirmDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
});

/**
 * Resolves a `ProjectThumbnailSource` to a renderable string URL.
 * Remote URLs are returned as-is — the browser owns their lifecycle.
 * Local Blobs are wrapped in an object URL that is revoked when the
 * source changes or the component unmounts. Returns null when there
 * is no source so the caller can render a placeholder without a
 * flicker.
 */
function useThumbnailRenderUrl(source: ProjectThumbnailSource | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  // URL.createObjectURL/revokeObjectURL is the resource lifecycle;
  // setUrl mirrors that external resource into React.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!source) {
      setUrl(null);
      return;
    }
    if (source.kind === 'url') {
      setUrl(source.url);
      return;
    }
    const next = URL.createObjectURL(source.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [source]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return url;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad2(mins)}:${pad2(secs)}` : `${mins}:${pad2(secs)}`;
}

function formatDate(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
