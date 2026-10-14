/**
 * Whether the keyboard shortcuts dialog is showing. A `'change'` event
 * fires on every transition; identical writes are suppressed.
 */
export class ShortcutsDialogStore extends EventTarget {

  private _isOpen = false;

  get isOpen(): boolean {
    return this._isOpen;
  }

  setOpen(open: boolean): void {
    if (this._isOpen === open) return;
    this._isOpen = open;
    this.dispatchEvent(new Event('change'));
  }
}
