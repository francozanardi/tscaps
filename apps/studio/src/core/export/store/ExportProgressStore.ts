/**
 * Observable container for the current export's progress percentage.
 *
 * Holds nothing else — phase, error, and toast state belong elsewhere.
 * Kept independent of the editor store so the per-frame writes during
 * an export do not invalidate the editor snapshot and re-render the
 * editor surface. Subscribers listen for `'change'` and read `percent`.
 */
export class ExportProgressStore extends EventTarget {
  private _percent = 0;

  get percent(): number {
    return this._percent;
  }

  setPercent(percent: number): void {
    const clamped = this.clampPercent(percent);
    if (clamped === this._percent) return;
    this._percent = clamped;
    this.dispatchEvent(new Event('change'));
  }

  reset(): void {
    if (this._percent === 0) return;
    this._percent = 0;
    this.dispatchEvent(new Event('change'));
  }

  private clampPercent(percent: number): number {
    return Math.max(0, Math.min(100, percent));
  }
}
