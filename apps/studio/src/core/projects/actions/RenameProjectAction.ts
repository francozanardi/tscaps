import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Updates the active project's display name and flags the editor as
 * having unsaved changes. Empty / whitespace-only names fall back to
 * "Untitled" so the dashboard never renders a blank card.
 */
export class RenameProjectAction {
  constructor(private readonly store: EditorStore) {}

  execute(name: string): void {
    if (!this.store.snapshot().projectId) return;
    const trimmed = name.trim();
    this.store.patch({
      projectName: trimmed.length > 0 ? trimmed : 'Untitled',
      dirty: true,
    });
  }
}
