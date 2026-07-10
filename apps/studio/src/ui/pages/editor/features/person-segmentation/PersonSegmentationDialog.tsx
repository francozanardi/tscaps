import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { AsyncButton } from '@ui/_shared/components/AsyncButton/AsyncButton';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import type { PersonSegmentationFlowMode } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import type { PersonSegmentationPhase } from '@core/person-segmentation/domain/PersonSegmentationProgress';

interface PersonSegmentationDialogProps {
  readonly mode: PersonSegmentationFlowMode;
  readonly error: string | null;
  readonly phase: PersonSegmentationPhase | null;
  readonly fraction: number;
  readonly onContinue: () => Promise<void>;
  readonly onCancel: () => void;
  readonly onRetry: () => Promise<void>;
}

const CONFIRM_TITLE = 'Prepare video for this template';
const CONFIRM_DESCRIPTION =
  'This template can hide captions behind the person on screen. ' +
  'We need to scan your video once to find where it works.';

const RUNNING_TITLE = 'Preparing your video…';
const RUNNING_HINT_BY_PHASE: Record<PersonSegmentationPhase, string> = {
  scanning: 'Looking for good moments…',
  'caching-masks': 'Cutting the actor out of the frames…',
};

const ERROR_TITLE = 'Could not prepare the video';
const ERROR_FALLBACK = 'Something went wrong while scanning. Please try again.';

/**
 * Modal that walks the user through the person-segmentation prep flow.
 * Renders a confirmation view before the scan starts, a progress view
 * while the detector runs, and an error view when the run fails.
 * Continue and Retry return promises so the buttons can show a busy
 * state until the run kicks off or the retry settles.
 */
export function PersonSegmentationDialog({
  mode,
  error,
  phase,
  fraction,
  onContinue,
  onCancel,
  onRetry,
}: PersonSegmentationDialogProps) {
  if (mode === 'closed') return null;
  const isRunning = mode === 'running';
  return (
    <AppDialog
      open
      onClose={onCancel}
      locked={isRunning}
      closeOnOutsideClick={false}
      size="md"
      title={titleFor(mode)}
      description={descriptionFor(mode, phase, error)}
    >
      {isRunning && <ProgressBar fraction={fraction} />}
      <AppDialogActions>
        {renderActions({ mode, onContinue, onCancel, onRetry })}
      </AppDialogActions>
    </AppDialog>
  );
}

function titleFor(mode: PersonSegmentationFlowMode): string {
  if (mode === 'running') return RUNNING_TITLE;
  if (mode === 'error') return ERROR_TITLE;
  return CONFIRM_TITLE;
}

function descriptionFor(
  mode: PersonSegmentationFlowMode,
  phase: PersonSegmentationPhase | null,
  error: string | null,
): string {
  if (mode === 'running') return phase ? RUNNING_HINT_BY_PHASE[phase] : RUNNING_HINT_BY_PHASE.scanning;
  if (mode === 'error') return error ?? ERROR_FALLBACK;
  return CONFIRM_DESCRIPTION;
}

function renderActions({
  mode,
  onContinue,
  onCancel,
  onRetry,
}: {
  mode: PersonSegmentationFlowMode;
  onContinue: () => Promise<void>;
  onCancel: () => void;
  onRetry: () => Promise<void>;
}) {
  if (mode === 'running') {
    return (
      <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
    );
  }
  if (mode === 'error') {
    return (
      <>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
        <AsyncButton className={BTN_PRIMARY_SM} onClick={onRetry} autoFocus>Try again</AsyncButton>
      </>
    );
  }
  return (
    <>
      <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
      <AsyncButton className={BTN_PRIMARY_SM} onClick={onContinue} autoFocus>Continue</AsyncButton>
    </>
  );
}

function ProgressBar({ fraction }: { readonly fraction: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div className="flex flex-col gap-1" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-1.5 w-full bg-surface-3 rounded-xs overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-quick ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-2xs text-fg-muted font-mono self-end">{percent}%</div>
    </div>
  );
}
