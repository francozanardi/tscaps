import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import type { AppError } from '@core/_shared/domain/AppError';
import { getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';

const AUTO_DISMISS_MS = 10000;
const DESCRIPTION
  = "We weren't able to save your changes. Check your connection. If it keeps happening, email support@tscaps.io.";

interface SaveFailedToastProps {
  readonly error: AppError | null;
}

/**
 * Corner notice that surfaces a project-save failure prominently.
 * Save is a background-style operation, so a non-modal toast is a
 * better fit than the inline sidebar banner the user may not look
 * at. Dismisses on click, auto-times out after a few seconds, and
 * resurfaces automatically on the next save failure because the
 * incoming error is a fresh instance.
 */
export function SaveFailedToast({ error }: SaveFailedToastProps) {
  const [dismissedFor, setDismissedFor] = useState<AppError | null>(null);
  const isSaveError = error?.name === 'ProjectSaveFailedError';
  const isFreshError = isSaveError && error !== dismissedFor;
  return (
    <Toast
      open={isFreshError}
      position="bottom-right"
      tone="error"
      icon={<AlertTriangle size={16} />}
      title={error ? getAppErrorTitle(error) : ''}
      description={DESCRIPTION}
      duration={AUTO_DISMISS_MS}
      onDismiss={() => setDismissedFor(error)}
    />
  );
}
