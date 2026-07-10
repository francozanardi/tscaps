interface TaskAttributionEntry {
  readonly name: string;
  readonly containerType: string;
  readonly containerSrc: string;
  readonly containerId: string;
  readonly containerName: string;
}

interface LongTaskPerformanceEntry extends PerformanceEntry {
  readonly attribution?: ReadonlyArray<TaskAttributionEntry>;
}

/**
 * Observes main-thread long tasks (>50ms) via
 * {@link PerformanceObserver} and logs one line per task. The
 * browser reports every task that blocks the main thread long
 * enough to skip a frame, so this is the most direct signal for
 * "the UI feels stuck" complaints. When available, attribution
 * names the containing script or frame — often enough to pin the
 * source (React render, GC pause, WebCodecs internal work, etc.).
 *
 * The `longtask` entry type is unsupported on Safari and some
 * older mobile browsers; those runs emit a single line noting
 * that fact and then stay silent.
 */
export class MainThreadLongTaskLogger {

  private observer: PerformanceObserver | null = null;

  start(): void {
    if (this.observer) return;
    if (!this.isLongTaskSupported()) {
      console.log('[LongTask] PerformanceObserver longtask entry type unsupported on this browser');
      return;
    }
    this.observer = this.buildAndStartObserver();
  }

  stop(): void {
    if (!this.observer) return;
    this.observer.disconnect();
    this.observer = null;
  }

  private isLongTaskSupported(): boolean {
    const supported = PerformanceObserver.supportedEntryTypes as ReadonlyArray<string> | undefined;
    return supported ? supported.includes('longtask') : false;
  }

  private buildAndStartObserver(): PerformanceObserver | null {
    const observer = new PerformanceObserver((list) => this.reportEntries(list));
    try {
      // Not buffered: replaying pre-start entries on every install would duplicate old tasks in the log.
      observer.observe({ type: 'longtask', buffered: false });
      return observer;
    } catch (err) {
      console.log(`[LongTask] failed to start PerformanceObserver: ${this.describeError(err)}`);
      return null;
    }
  }

  private reportEntries(list: PerformanceObserverEntryList): void {
    for (const entry of list.getEntries()) {
      this.reportEntry(entry as LongTaskPerformanceEntry);
    }
  }

  private reportEntry(entry: LongTaskPerformanceEntry): void {
    console.log(
      `[LongTask] duration=${entry.duration.toFixed(1)}ms`
      + ` name=${entry.name}`
      + ` startTime=${entry.startTime.toFixed(1)}ms`
      + ` attribution=${this.summarizeAttribution(entry.attribution)}`,
    );
  }

  private summarizeAttribution(attribution: ReadonlyArray<TaskAttributionEntry> | undefined): string {
    if (!attribution || attribution.length === 0) return 'none';
    return attribution
      .map((a) => `${a.name || 'unknown'}(${a.containerType || 'unknown'})`)
      .join(',');
  }

  private describeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
