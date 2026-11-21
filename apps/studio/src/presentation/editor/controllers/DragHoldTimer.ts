/**
 * Fires once a drag has been held over the same target for a while,
 * the way a desktop opens a folder a file is held over. Holding over
 * another target starts the wait again for that one; leaving cancels.
 */
export class DragHoldTimer<Target> {
  private held: { target: Target; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(private readonly holdMs: number) {}

  /** Starts waiting to call `onHeld` for `target`, unless already waiting for it. */
  hold(target: Target, onHeld: () => void): void {
    if (this.held !== null && Object.is(this.held.target, target)) return;
    this.cancel();
    const timer = setTimeout(() => {
      this.held = null;
      onHeld();
    }, this.holdMs);
    this.held = { target, timer };
  }

  cancel(): void {
    if (this.held !== null) clearTimeout(this.held.timer);
    this.held = null;
  }
}
