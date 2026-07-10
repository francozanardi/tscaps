import { AlertTriangle } from 'lucide-react';

interface OriginalVideoDownloadBannerProps {
  readonly onBackToProjects: () => void;
}

/**
 * Pure banner shown above the editor when the project's original
 * video bytes failed to land. Surfaces a short explanation and a
 * "Back to projects" escape hatch — the user has no local file to
 * re-pick at this point, so reopening the project is the only path
 * that can restart the fetch.
 */
export function OriginalVideoDownloadBanner({ onBackToProjects }: OriginalVideoDownloadBannerProps) {
  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-40 flex items-center justify-center gap-3 px-4 py-2 bg-danger-soft text-danger border-b border-danger/40"
    >
      <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />
      <span className="text-sm">
        We couldn't fetch your original video. Check your connection and reopen the project.
      </span>
      <button
        type="button"
        onClick={onBackToProjects}
        className="text-sm font-medium underline underline-offset-2 hover:text-danger-hover focus-visible:outline-none focus-visible:text-danger-hover"
      >
        Back to projects
      </button>
    </div>
  );
}
