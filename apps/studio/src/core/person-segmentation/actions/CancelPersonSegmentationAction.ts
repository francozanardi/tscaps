import type { PersonSegmentationRunController } from '@core/person-segmentation/services/PersonSegmentationRunController';

/**
 * Aborts the in-flight person-segmentation run, if any. The run's
 * promise rejects with an `AbortError` at the next cooperative check;
 * the progress store is reset by the run action's cleanup path.
 * Calling this action when no run is active is a no-op.
 */
export class CancelPersonSegmentationAction {

  constructor(private readonly runController: PersonSegmentationRunController) {}

  execute(): void {
    this.runController.cancel();
  }
}
