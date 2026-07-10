import { useEffect, useState } from 'react';
import type { EnsurePersonSegmentationCachedAction } from '@core/person-segmentation/actions/EnsurePersonSegmentationCachedAction';
import type { CancelPersonSegmentationAction } from '@core/person-segmentation/actions/CancelPersonSegmentationAction';
import type { PersonSegmentationFlowStore, PersonSegmentationFlowStatus } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import type { PersonSegmentationProgressStore, PersonSegmentationProgressStatus } from '@core/person-segmentation/store/PersonSegmentationProgressStore';
import { PersonSegmentationDialog } from '@ui/pages/editor/features/person-segmentation/PersonSegmentationDialog';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

function useFlowStatus(flow: PersonSegmentationFlowStore): PersonSegmentationFlowStatus {
  const [status, setStatus] = useState<PersonSegmentationFlowStatus>(() => flow.status);
  useEffect(() => {
    const update = (): void => setStatus(flow.status);
    flow.addEventListener('change', update);
    update();
    return () => flow.removeEventListener('change', update);
  }, [flow]);
  return status;
}

function useProgressStatus(progress: PersonSegmentationProgressStore): PersonSegmentationProgressStatus {
  const [status, setStatus] = useState<PersonSegmentationProgressStatus>(() => progress.status);
  useEffect(() => {
    const update = (): void => setStatus(progress.status);
    progress.addEventListener('change', update);
    update();
    return () => progress.removeEventListener('change', update);
  }, [progress]);
  return status;
}

async function runEnsureCached(
  flow: PersonSegmentationFlowStore,
  ensureCached: EnsurePersonSegmentationCachedAction,
): Promise<void> {
  flow.startRunning();
  try {
    await ensureCached.execute();
    flow.finishRunning();
  } catch (error) {
    if (isAbortError(error)) {
      flow.close();
      return;
    }
    flow.failRunning(errorMessageOf(error));
  }
}

function handleCancel(
  flow: PersonSegmentationFlowStore,
  cancel: CancelPersonSegmentationAction,
  currentMode: PersonSegmentationFlowStatus['mode'],
): void {
  if (currentMode === 'running') cancel.execute();
  flow.close();
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return 'Something went wrong while scanning. Please try again.';
}

/**
 * Mounts the prepare-video dialog only while the flow store's mode
 * is non-`closed`. Reads live progress from the progress store,
 * threads the confirm / cancel / retry callbacks into the dialog, and
 * translates their outcomes back into flow-store transitions.
 */
export function PersonSegmentationDialogHost() {
  const personSegmentation = usePersonSegmentation();
  const { flowStore, progressStore, actions } = personSegmentation;
  const flowStatus = useFlowStatus(flowStore);
  const progressStatus = useProgressStatus(progressStore);

  if (flowStatus.mode === 'closed') return null;

  return (
    <PersonSegmentationDialog
      mode={flowStatus.mode}
      error={flowStatus.error}
      phase={progressStatus.phase}
      fraction={progressStatus.fraction}
      onContinue={() => runEnsureCached(flowStore, actions.ensureCached)}
      onRetry={() => runEnsureCached(flowStore, actions.ensureCached)}
      onCancel={() => handleCancel(flowStore, actions.cancel, flowStatus.mode)}
    />
  );
}
