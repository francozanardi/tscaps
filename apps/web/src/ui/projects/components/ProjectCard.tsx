import { memo, useEffect, useState } from 'react';
import { Trash2, Download } from 'lucide-react';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectThumbnailSource } from '@core/projects/domain/ProjectThumbnailSource';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

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

const ACTION_BTN_BASE =
  'w-7 h-7 inline-flex items-center justify-center bg-surface-1/80 backdrop-blur-sm ' +
  'border border-edge-medium rounded-xs text-fg-secondary cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:border-accent';

const ACTION_BTN = `${ACTION_BTN_BASE} hover:bg-surface-2 hover:text-fg-primary`;
const ACTION_BTN_DANGER = `${ACTION_BTN_BASE} hover:bg-danger/15 hover:border-danger/40 hover:text-danger`;

const STATUS_PILL_BASE =
  'inline-flex items-center font-mono text-3xs uppercase tracking-[0.06em] ' +
  'px-1.5 py-0.5 rounded-pill';
const STATUS_TRANSCRIBED = `${STATUS_PILL_BASE} bg-accent/10 text-info`;
const STATUS_PENDING = `${STATUS_PILL_BASE} bg-warning/10 text-warning`;

export const ProjectCard = memo(function ProjectCard({ project, onOpen, onDelete, onExport }: ProjectCardProps) {
  const thumbUrl = useThumbnailRenderUrl(project.thumbnail);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExport) onExport(project.id);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div
        className={CARD}
        onClick={() => onOpen(project.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(project.id); }}
      >
        <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
          {thumbUrl
            ? <img src={thumbUrl} alt="" className="w-full h-full object-cover block" />
            : <div className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-faint">No preview</div>
          }
        </div>
        <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-1.5 min-w-0">
          <div className="text-md font-medium text-fg-primary truncate" title={project.name}>{project.name}</div>
          <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
            <span className="tabular-nums">{formatDate(project.updatedAt)}</span>
            {project.hasDocument
              ? <span className={STATUS_TRANSCRIBED}>Transcribed</span>
              : <span className={STATUS_PENDING}>Pending</span>
            }
          </div>
          <div className="text-2xs text-fg-faint truncate" title={project.video.fileName}>{project.video.fileName}</div>
        </div>
        <div
          className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 transition-opacity duration-quick ease-standard group-hover/card:opacity-100 group-focus-within/card:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {onExport && (
            <Tooltip text="Export project" position="bottom">
              <button className={ACTION_BTN} onClick={handleExport} aria-label="Export project">
                <Download size={14} />
              </button>
            </Tooltip>
          )}
          <Tooltip text="Delete project" position="bottom">
            <button className={ACTION_BTN_DANGER} onClick={handleDelete} aria-label="Delete project">
              <Trash2 size={14} />
            </button>
          </Tooltip>
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
