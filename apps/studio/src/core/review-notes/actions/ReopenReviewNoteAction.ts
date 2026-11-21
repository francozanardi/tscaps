import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Puts a sent note back as a draft, for the person to send again with
 * the next batch: nothing may have read it (a reply that failed), or the
 * person wants it read again. Answers whether it did; a draft stays as
 * it is.
 */
export class ReopenReviewNoteAction {
  constructor(private readonly store: EditorStore) {}

  execute(id: string): boolean {
    const notes = this.store.snapshot().reviewNotes;
    const note = notes.find(id);
    if (note === null || note.status === 'draft') return false;
    this.store.commit('Send note again');
    this.store.patch({ reviewNotes: notes.replacing({ ...note, status: 'draft', batchId: null }) });
    return true;
  }
}
