export type PersonSegmentationFlowMode = 'closed' | 'confirm' | 'running' | 'error';

export interface PersonSegmentationFlowStatus {
  readonly mode: PersonSegmentationFlowMode;
  readonly error: string | null;
}

/**
 * Observable state machine for the "prepare person segmentation"
 * dialog. Only tracks the dialog's mode plus any last-run error
 * message; the raw run progress lives in `PersonSegmentationProgressStore`
 * so per-tick updates do not invalidate the mode snapshot.
 *
 * Subscribers listen for the `'change'` event and read `status`.
 */
export class PersonSegmentationFlowStore extends EventTarget {
  private static readonly INITIAL: PersonSegmentationFlowStatus = {
    mode: 'closed',
    error: null,
  };

  private currentStatus: PersonSegmentationFlowStatus = PersonSegmentationFlowStore.INITIAL;

  get status(): PersonSegmentationFlowStatus {
    return this.currentStatus;
  }

  openConfirm(): void {
    if (this.currentStatus.mode === 'confirm' || this.currentStatus.mode === 'running') return;
    this.publish({ mode: 'confirm', error: null });
  }

  startRunning(): void {
    this.publish({ mode: 'running', error: null });
  }

  finishRunning(): void {
    this.publish({ mode: 'closed', error: null });
  }

  failRunning(errorMessage: string): void {
    this.publish({ mode: 'error', error: errorMessage });
  }

  close(): void {
    this.publish({ mode: 'closed', error: null });
  }

  private publish(next: PersonSegmentationFlowStatus): void {
    this.currentStatus = next;
    this.dispatchEvent(new Event('change'));
  }
}
