/**
 * Unconditional `beforeunload` prompt installer. While running, any
 * attempt to navigate away or close the tab triggers the browser's
 * confirmation dialog regardless of page state. Intended for
 * long-running tasks where losing the page mid-flight is destructive.
 */
export class BeforeUnloadPrompt {
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  private onBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    // Legacy Chrome/Edge still need `returnValue` set for the prompt to show.
    event.returnValue = '';
  };
}
