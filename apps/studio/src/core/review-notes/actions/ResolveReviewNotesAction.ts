import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ReviewNoteResolution } from '@core/review-notes/domain/ReviewNoteResolution';

/**
 * Resolves sent notes by their numbers, as whoever edits the video works
 * through a batch: a note that was done is removed, so the frame keeps
 * only what is still to do. One step of the edit history, so taking it
 * back brings the notes back. Answers one result per number, in order;
 * a draft is refused, since it was never sent.
 */
export class ResolveReviewNotesAction {
  constructor(private readonly store: EditorStore) {}

  execute(numbers: ReadonlyArray<number>): ReadonlyArray<ReviewNoteResolution> {
    const held = this.store.snapshot().reviewNotes;
    let notes = held;
    const results = numbers.map((number): ReviewNoteResolution => {
      const note = notes.findByNumber(number);
      if (note === null) return 'unknown';
      if (note.status === 'draft') return 'not-sent';
      notes = notes.removing(note.id);
      return 'resolved';
    });
    if (notes !== held) {
      this.store.commit('Resolve notes');
      this.store.patch({ reviewNotes: notes });
    }
    return results;
  }
}
