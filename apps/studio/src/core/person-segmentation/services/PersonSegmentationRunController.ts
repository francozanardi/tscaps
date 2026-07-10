/**
 * Coordinates the lifecycle of a single detector run. The run action
 * begins a run and holds the abort signal it propagates to the
 * segmenter; the cancel action asks the controller to abort. The
 * controller enforces one run at a time — a second `begin` while a
 * run is active throws.
 */
export class PersonSegmentationRunController {
  private currentAbortController: AbortController | null = null;

  begin(): AbortSignal {
    if (this.currentAbortController !== null) {
      throw new Error('A person-segmentation run is already in progress');
    }
    this.currentAbortController = new AbortController();
    return this.currentAbortController.signal;
  }

  finish(): void {
    this.currentAbortController = null;
  }

  cancel(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  get isRunning(): boolean {
    return this.currentAbortController !== null;
  }
}
