interface HeapMemorySnapshot {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  readonly memory?: HeapMemorySnapshot;
}

/**
 * Periodic snapshot of the JavaScript heap during preview
 * playback. Emits one line per {@link reportIntervalMs} while
 * running so a post-hoc log tail can correlate memory growth
 * against pump activity and separate a sustained leak (heap keeps
 * climbing) from a spike (single allocation burst) from an
 * off-heap failure (heap plateaus but the tab still dies).
 *
 * `performance.memory` is a Chromium-only extension. On browsers
 * that don't expose it the logger emits an "unavailable" line
 * once at start, so the tail still records that diagnostics were
 * requested even when heap data can't be observed.
 */
export class PreviewMemoryPressureLogger {

  private intervalId: number | null = null;

  constructor(private readonly reportIntervalMs: number = 1000) {}

  start(): void {
    if (this.intervalId !== null) return;
    const snapshot = this.readHeapSnapshot();
    if (!snapshot) {
      console.log('[Memory] performance.memory unavailable on this browser');
      return;
    }
    this.logSnapshot(snapshot);
    this.intervalId = window.setInterval(() => this.pollAndLog(), this.reportIntervalMs);
  }

  stop(): void {
    if (this.intervalId === null) return;
    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private pollAndLog(): void {
    const snapshot = this.readHeapSnapshot();
    if (snapshot) this.logSnapshot(snapshot);
  }

  private readHeapSnapshot(): HeapMemorySnapshot | null {
    const perf = performance as PerformanceWithMemory;
    return perf.memory ?? null;
  }

  private logSnapshot(snapshot: HeapMemorySnapshot): void {
    const usedMb = this.toMegabytes(snapshot.usedJSHeapSize);
    const totalMb = this.toMegabytes(snapshot.totalJSHeapSize);
    const limitMb = this.toMegabytes(snapshot.jsHeapSizeLimit);
    const usedPct = ((snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit) * 100).toFixed(1);
    console.log(`[Memory] heap=${usedMb}MB used / ${totalMb}MB total (limit=${limitMb}MB, ${usedPct}%)`);
  }

  private toMegabytes(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1);
  }
}
