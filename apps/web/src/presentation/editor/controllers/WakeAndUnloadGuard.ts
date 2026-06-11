/**
 * Holds a screen wake lock and a beforeunload prompt for the duration of
 * a long-running task. Wake lock is best-effort: browsers without the
 * API silently degrade. The lock is re-acquired on `visibilitychange`
 * since the browser releases it whenever the tab goes hidden.
 */
export class WakeAndUnloadGuard {
  private sentinel: WakeLockSentinel | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener('beforeunload', this.onBeforeUnload);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.acquireWakeLock();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.releaseWakeLock();
  }

  private acquireWakeLock = async (): Promise<void> => {
    if (!('wakeLock' in navigator)) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      this.sentinel = null;
    }
  };

  private releaseWakeLock = async (): Promise<void> => {
    const s = this.sentinel;
    this.sentinel = null;
    if (!s) return;
    try { await s.release(); } catch { /* already released */ }
  };

  private onVisibilityChange = (): void => {
    if (!this.running) return;
    if (document.visibilityState !== 'visible') return;
    if (this.sentinel) return;
    void this.acquireWakeLock();
  };

  private onBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    // Legacy Chrome/Edge still need `returnValue` set for the prompt to show.
    event.returnValue = '';
  };
}
