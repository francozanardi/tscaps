/**
 * Periodic, opt-in counters for the playback pump. Records
 * decode / paint / buffer events as they happen and flushes a
 * single-line summary to the console every {@link reportIntervalMs}.
 *
 * Disabled in production; the pump only instantiates and feeds
 * one of these when its debug flag is on. Each metric is averaged
 * (or per-second-rated) over the report window, then reset.
 */
export class RafVideoFramePumpDiagnostics {

  private decodeYields = 0;
  private framesPushed = 0;
  private framesPainted = 0;
  private rafTicks = 0;
  private bufferEmptyOnTick = 0;
  private decodeLatencySumMs = 0;
  private decodeLatencyCount = 0;
  private paintLatencySumMs = 0;
  private paintLatencyCount = 0;
  private maxBufferSize = 0;
  private bufferSizeSum = 0;
  private bufferSizeSamples = 0;
  private longCutSwaps = 0;
  private inCutDrops = 0;
  private clockTargetAtWindowStart: number | null = null;
  private latestClockTarget = 0;
  private latestBufferHeadOutputSec: number | null = null;
  private latestBufferTailOutputSec: number | null = null;

  private reportTimerId: number | null = null;
  private lastReportAt = 0;
  private readonly reportIntervalMs: number;

  constructor(reportIntervalMs = 1000) {
    this.reportIntervalMs = reportIntervalMs;
  }

  start(): void {
    if (this.reportTimerId !== null) return;
    this.lastReportAt = performance.now();
    this.reportTimerId = window.setInterval(() => this.report(), this.reportIntervalMs);
  }

  stop(): void {
    if (this.reportTimerId === null) return;
    window.clearInterval(this.reportTimerId);
    this.reportTimerId = null;
    this.report();
  }

  recordIteratorYield(latencyMs: number): void {
    this.decodeYields++;
    this.decodeLatencySumMs += latencyMs;
    this.decodeLatencyCount++;
  }

  recordFramePushed(bufferSize: number): void {
    this.framesPushed++;
    this.observeBufferSize(bufferSize);
  }

  recordFramePainted(latencyMs: number): void {
    this.framesPainted++;
    this.paintLatencySumMs += latencyMs;
    this.paintLatencyCount++;
  }

  recordRafTick(bufferSize: number, frameTaken: boolean): void {
    this.rafTicks++;
    if (!frameTaken) this.bufferEmptyOnTick++;
    this.observeBufferSize(bufferSize);
  }

  recordClockTarget(target: number): void {
    if (this.clockTargetAtWindowStart === null) this.clockTargetAtWindowStart = target;
    this.latestClockTarget = target;
  }

  recordBufferOutputTimeRange(headOutputSec: number | null, tailOutputSec: number | null): void {
    this.latestBufferHeadOutputSec = headOutputSec;
    this.latestBufferTailOutputSec = tailOutputSec;
  }

  recordLongCutSwap(): void {
    this.longCutSwaps++;
  }

  recordInCutDrop(): void {
    this.inCutDrops++;
  }

  private observeBufferSize(size: number): void {
    if (size > this.maxBufferSize) this.maxBufferSize = size;
    this.bufferSizeSum += size;
    this.bufferSizeSamples++;
  }

  private report(): void {
    const now = performance.now();
    const elapsedSec = (now - this.lastReportAt) / 1000;
    if (elapsedSec <= 0) return;

    const decodeFps = this.decodeYields / elapsedSec;
    const paintFps = this.framesPainted / elapsedSec;
    const rafHz = this.rafTicks / elapsedSec;
    const avgDecodeMs = this.average(this.decodeLatencySumMs, this.decodeLatencyCount);
    const avgPaintMs = this.average(this.paintLatencySumMs, this.paintLatencyCount);
    const avgBuffer = this.average(this.bufferSizeSum, this.bufferSizeSamples);
    const clockAdvanceRate = this.computeClockAdvanceRate(elapsedSec);
    const bufferRange = this.formatBufferOutputRange();
    const target = this.latestClockTarget.toFixed(3);

    console.log(
      `[Pump] decode=${decodeFps.toFixed(1)}fps pull=${avgDecodeMs.toFixed(1)}ms`
      + ` paint=${paintFps.toFixed(1)}fps@${avgPaintMs.toFixed(1)}ms`
      + ` raf=${rafHz.toFixed(0)}Hz(empty=${this.bufferEmptyOnTick})`
      + ` buf=${avgBuffer.toFixed(1)}avg/${this.maxBufferSize}max ${bufferRange}`
      + ` clock=${target}s@${clockAdvanceRate.toFixed(2)}x`
      + ` cut-drops=${this.inCutDrops} long-swaps=${this.longCutSwaps}`,
    );

    this.resetWindowedCounters(now);
  }

  private average(sum: number, count: number): number {
    return count > 0 ? sum / count : 0;
  }

  private computeClockAdvanceRate(elapsedSec: number): number {
    if (this.clockTargetAtWindowStart === null) return 0;
    const advanced = this.latestClockTarget - this.clockTargetAtWindowStart;
    return elapsedSec > 0 ? advanced / elapsedSec : 0;
  }

  private formatBufferOutputRange(): string {
    if (this.latestBufferHeadOutputSec === null || this.latestBufferTailOutputSec === null) {
      return 'buf-range=empty';
    }
    const head = this.latestBufferHeadOutputSec.toFixed(3);
    const tail = this.latestBufferTailOutputSec.toFixed(3);
    return `buf-range=${head}..${tail}s`;
  }

  private resetWindowedCounters(now: number): void {
    this.lastReportAt = now;
    this.decodeYields = 0;
    this.framesPushed = 0;
    this.framesPainted = 0;
    this.rafTicks = 0;
    this.bufferEmptyOnTick = 0;
    this.decodeLatencySumMs = 0;
    this.decodeLatencyCount = 0;
    this.paintLatencySumMs = 0;
    this.paintLatencyCount = 0;
    this.maxBufferSize = 0;
    this.bufferSizeSum = 0;
    this.bufferSizeSamples = 0;
    this.longCutSwaps = 0;
    this.inCutDrops = 0;
    this.clockTargetAtWindowStart = this.latestClockTarget;
  }
}
