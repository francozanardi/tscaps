import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';
import type { PreviewProxyDownloadStatus } from '@core/preview/store/PreviewProxyDownloadStore';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';

interface ProjectLoadingIndicatorProps {
  readonly downloadStatus: OriginalVideoDownloadStatus;
  /**
   * Progress of the preview copy. Takes precedence while it is
   * moving: that is the fetch the reader is actually held on.
   */
  readonly proxyDownloadStatus: PreviewProxyDownloadStatus;
}

const CLUSTER = 'flex flex-col items-center gap-3';
const CAPTION = 'text-sm text-fg-muted m-0';

/**
 * Loading indicator surfaced while a project is being hydrated. Shows
 * a status pill and, when bytes are being fetched, folds the fetch's
 * progress fraction and a short caption into the same cluster so the
 * visitor sees they are waiting on I/O rather than a hung tab.
 *
 * Two fetches can be running, and the one worth reporting is the one
 * holding the reader here: a project with a preview copy opens on it
 * and streams the original in behind the editor, so the preview wins
 * while it is moving. A project without one has only the original to
 * wait on, and that is what gets reported instead.
 *
 * Container-agnostic: callers wrap it in whatever full-screen or
 * modal frame they want. The pill's label stays "Loading project"
 * throughout; only the progress and caption toggle on download state.
 */
export function ProjectLoadingIndicator({ downloadStatus, proxyDownloadStatus }: ProjectLoadingIndicatorProps) {
  const blocking = proxyDownloadStatus.kind === 'downloading' ? proxyDownloadStatus : downloadStatus;
  const isDownloading = blocking.kind === 'downloading';
  const hasProgress = isDownloading && blocking.progress !== null;
  const downloadingCaption = 'Opening';
  return (
    <div className={CLUSTER}>
      {hasProgress
        ? <StatusPill label="Loading project" tone="info" active progress={blocking.progress * 100} />
        : <StatusPill label="Loading project" tone="info" active />}
      {isDownloading && (
        <p className={CAPTION}>{downloadingCaption}</p>
      )}
    </div>
  );
}
