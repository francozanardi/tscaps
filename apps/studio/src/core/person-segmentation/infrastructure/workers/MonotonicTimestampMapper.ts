/**
 * Maps requested video timestamps onto a strictly increasing sequence.
 * MediaPipe tasks in `VIDEO` running mode reject any timestamp that is
 * not greater than the last one the task instance has seen — for the
 * instance's whole lifetime, not per logical run. Re-scans and
 * on-demand captures legitimately revisit earlier positions, so the
 * requested time cannot be fed to the task directly.
 *
 * `next` returns the requested value when it already advances the
 * sequence, and the smallest strictly-greater value (+1 ms) otherwise.
 * Use one mapper per task instance and discard it with the instance.
 */
export class MonotonicTimestampMapper {
  private lastTimestampMs = -1;

  next(requestedMs: number): number {
    this.lastTimestampMs = Math.max(requestedMs, this.lastTimestampMs + 1);
    return this.lastTimestampMs;
  }
}
