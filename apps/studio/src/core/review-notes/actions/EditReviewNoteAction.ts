import type { EditorStore } from '@core/editor/store/EditorStore';
import { REVIEW_NOTE_MAX_TEXT_LENGTH } from '@core/review-notes/domain/ReviewNoteText';

/**
 * Rewrites a draft note's text, as one step of the edit history.
 * Answers whether it did: a note already
 * sent keeps what it said, and blank text leaves the note as it was.
 */
export class EditReviewNoteAction {
  constructor(private readonly store: EditorStore) {}

  execute(id: string, text: string): boolean {
    const notes = this.store.snapshot().reviewNotes;
    const note = notes.find(id);
    const trimmed = text.trim().slice(0, REVIEW_NOTE_MAX_TEXT_LENGTH);
    if (note === null || note.status !== 'draft' || trimmed === '') return false;
    if (trimmed === note.text) return true;
    this.store.commit('Edit note');
    this.store.patch({ reviewNotes: notes.replacing({ ...note, text: trimmed }) });
    return true;
  }
}
