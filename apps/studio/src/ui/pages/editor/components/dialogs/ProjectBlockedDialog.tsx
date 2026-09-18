import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle, useFailureReason } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import type { AppError } from '@core/errors/domain/AppError';

interface ProjectBlockedDialogProps {
  readonly error: AppError;
  readonly onBackToProjects: () => void;
}

/**
 * Modal for a failure that leaves the editor with no project to show —
 * it never opened, or its preview never loaded. There is nothing to
 * work on behind the dialog, so leaving it — ESC, the close
 * affordance, the secondary button — always lands on the projects
 * list.
 *
 * Reloading is offered next to it because it is the first remedy the
 * message names, and it is the only one that can fix a page whose
 * session went bad rather than the project itself. Sending someone
 * back to the list instead would drop them where the same tap fails
 * again.
 *
 * A project that is simply not there is the exception: nothing broke,
 * so there is nothing to retry, and a reload would only serve the
 * same dialog. The way out becomes the only action.
 */
export function ProjectBlockedDialog({ error, onBackToProjects }: ProjectBlockedDialogProps) {
  const isMobile = useIsMobileViewport();
  const isRetryable = useFailureReason(error) !== 'not-found';
  const reload = (): void => window.location.reload();
  return (
    <AppDialog
      open
      onClose={onBackToProjects}
      closeOnOutsideClick={false}
      size="md"
      title={getAppErrorTitle(error)}
    >
      <div className="space-y-4">
        <AppErrorMessage error={error} isMobile={isMobile} />
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className={isRetryable ? BTN_SECONDARY_SM : BTN_PRIMARY_SM}
            onClick={onBackToProjects}
            autoFocus={!isRetryable}
          >
            Back to projects
          </button>
          {isRetryable && (
            <button type="button" className={BTN_PRIMARY_SM} onClick={reload} autoFocus>
              Reload
            </button>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
