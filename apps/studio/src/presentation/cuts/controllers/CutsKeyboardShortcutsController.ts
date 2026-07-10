import type { AddCutAction } from '@core/cuts/actions/AddCutAction';
import type { CutsEditingController } from '@presentation/cuts/controllers/CutsEditingController';

/**
 * Keyboard gestures for the Cuts mode. Escape clears any in-progress
 * selection; Delete and Backspace commit the active selection as a
 * cut and then clear it. Inert when no selection exists.
 *
 * Started and stopped by the cuts host based on the active mode, so
 * the global window listener is only attached while the Cuts panel
 * is the foreground surface. The host is also responsible for not
 * starting the controller from inside text inputs; the controller
 * additionally guards on `document.activeElement` so a focused input
 * inside the panel keeps its native behaviour.
 */
export class CutsKeyboardShortcutsController {
  constructor(
    private readonly editing: CutsEditingController,
    private readonly addCut: AddCutAction,
  ) {}

  start(): void {
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.isTextInputFocused()) return;
    const selection = this.editing.selection;
    if (event.key === 'Escape') {
      if (!selection) return;
      event.preventDefault();
      this.editing.clearSelection();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (!selection) return;
      event.preventDefault();
      this.addCut.execute({ startSec: selection.startSec, endSec: selection.endSec });
      this.editing.clearSelection();
    }
  };

  private isTextInputFocused(): boolean {
    const element = document.activeElement;
    if (!element) return false;
    const tag = element.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    return element instanceof HTMLElement && element.isContentEditable;
  }
}
