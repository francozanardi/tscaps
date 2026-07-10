import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UnsavedWorkPolicy } from '@core/projects/domain/UnsavedWorkPolicy';

/**
 * Warns before leave when the editor has unsaved edits or is still
 * preprocessing the video — both states represent work that would be
 * lost if the tab were closed.
 */
export class EditorStateUnsavedWorkPolicy implements UnsavedWorkPolicy {
  constructor(private readonly store: EditorStore) {}

  shouldWarnBeforeLeave(): boolean {
    const snapshot = this.store.snapshot();
    return snapshot.dirty || snapshot.status === 'preprocessing';
  }
}
