import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';

interface ProjectLoadingIndicatorProps {
  readonly downloadStatus: OriginalVideoDownloadStatus;
}

const CLUSTER = 'flex flex-col items-center gap-3';
const CAPTION = 'text-sm text-fg-muted m-0';

/**
 * Loading indicator surfaced while a project is being hydrated. Shows
 * a status pill and, when the source bytes are being fetched, folds
 * the fetch's progress fraction and a short caption into the same
 * cluster so the visitor sees they are waiting on I/O rather than a
 * hung tab.
 *
 * Container-agnostic: callers wrap it in whatever full-screen or
 * modal frame they want. The pill's label stays "Loading project"
 * throughout; only the progress and caption toggle on download state.
 */
export function ProjectLoadingIndicator({ downloadStatus }: ProjectLoadingIndicatorProps) {
  const isDownloading = downloadStatus.kind === 'downloading';
  const hasProgress = isDownloading && downloadStatus.progress !== null;
  const downloadingCaption = 'Opening';
  return (
    <div className={CLUSTER}>
      {hasProgress
        ? <StatusPill label="Loading project" tone="info" active progress={downloadStatus.progress * 100} />
        : <StatusPill label="Loading project" tone="info" active />}
      {isDownloading && (
        <p className={CAPTION}>{downloadingCaption}</p>
      )}
    </div>
  );
}
