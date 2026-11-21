import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Drops a note, sent or not, as one step of the edit history: a sent
 * note the assistant left (it could not be done) is the person's to
 * clear. Answers whether there was such a note.
 */
export class DeleteReviewNoteAction {
  constructor(private readonly store: EditorStore) {}

  execute(id: string): boolean {
    const notes = this.store.snapshot().reviewNotes;
    const note = notes.find(id);
    if (note === null) return false;
    this.store.commit('Delete note');
    this.store.patch({ reviewNotes: notes.removing(id) });
    return true;
  }
}
