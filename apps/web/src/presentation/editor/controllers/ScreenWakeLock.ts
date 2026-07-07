/**
 * Holds a screen wake lock for the duration of a long-running task.
 * Best-effort: browsers without the Wake Lock API silently degrade.
 * The lock is re-acquired on `visibilitychange` because the browser
 * releases it whenever the tab goes hidden.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.acquire();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.release();
  }

  private acquire = async (): Promise<void> => {
    if (!('wakeLock' in navigator)) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      this.sentinel = null;
    }
  };

  private release = async (): Promise<void> => {
    const s = this.sentinel;
    this.sentinel = null;
    if (!s) return;
    try { await s.release(); } catch { /* already released */ }
  };

  private onVisibilityChange = (): void => {
    if (!this.running) return;
    if (document.visibilityState !== 'visible') return;
    if (this.sentinel) return;
    void this.acquire();
  };
}
