import { KeyboardShortcut } from '@presentation/editor/services/KeyboardShortcut';

export const FIND_SHORTCUT = new KeyboardShortcut('f', true);
export const LOCATE_SHORTCUT = new KeyboardShortcut('g', true);

/**
 * Window-level keyboard shortcuts for an editor panel's Search and
 * "Go to current segment" actions: Cmd/Ctrl+F opens search, Cmd/Ctrl+G
 * jumps to the playhead-active segment.
 *
 * Lifecycle is `start()`/`stop()` so the host can attach the listener
 * only while its panel is the foreground surface — two instances
 * running at once would fight each other for the same key combos.
 * Native browser behaviour for both combos is suppressed via
 * `preventDefault`.
 */
export class FindAndLocateShortcutsController {

  constructor(
    private readonly onOpenSearch: () => void,
    private readonly onLocate: () => void,
  ) {}

  start(): void {
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (FIND_SHORTCUT.matches(event)) {
      event.preventDefault();
      this.onOpenSearch();
      return;
    }
    if (LOCATE_SHORTCUT.matches(event)) {
      event.preventDefault();
      this.onLocate();
    }
  };
}
