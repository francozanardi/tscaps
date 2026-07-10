/**
 * Observable set of segments whose actor masks are being computed on
 * demand. UI surfaces read it to show a per-segment busy indicator
 * while a forced-on segment outside the detector's windows waits for
 * its masks.
 *
 * Subscribers listen for the `'change'` event and read `isPending`.
 */
export class SegmentMaskBackfillStore extends EventTarget {
  private readonly pendingIds = new Set<string>();

  isPending(segmentId: string): boolean {
    return this.pendingIds.has(segmentId);
  }

  hasAnyPending(): boolean {
    return this.pendingIds.size > 0;
  }

  begin(segmentId: string): void {
    if (this.pendingIds.has(segmentId)) return;
    this.pendingIds.add(segmentId);
    this.dispatchEvent(new Event('change'));
  }

  finish(segmentId: string): void {
    if (!this.pendingIds.delete(segmentId)) return;
    this.dispatchEvent(new Event('change'));
  }
}
