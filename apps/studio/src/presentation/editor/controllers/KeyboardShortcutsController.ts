import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Listens for global editor keyboard shortcuts and dispatches them to the
 * store. Currently: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y (redo).
 *
 * Runs regardless of focus so the user never feels Ctrl+Z "stuck" while a
 * scene textarea has focus. The browser's native field undo is suppressed
 * (`preventDefault`); letting both run would round-trip through the
 * field's controlled `onChange` and produce extra history commits.
 * Components that own controlled inputs are responsible for resyncing
 * their local mirror when the model text changes externally.
 */
export class KeyboardShortcutsController {
  constructor(private readonly store: EditorStore) {}

  start(): void {
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
    } else if (key === 'y') {
      e.preventDefault();
      this.store.redo();
    }
  };
}
