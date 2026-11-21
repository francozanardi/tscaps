import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteDraft } from '@core/review-notes/domain/ReviewNoteDraft';
import { REVIEW_NOTE_MAX_TEXT_LENGTH } from '@core/review-notes/domain/ReviewNoteText';

/**
 * Keeps what the person said as a draft note of the open project, with
 * the next number, as one step of the edit history. Answers the note,
 * or null when there is nothing to say (the text is blank). Text past
 * {@link REVIEW_NOTE_MAX_TEXT_LENGTH} characters is cut.
 */
export class AddReviewNoteAction {
  constructor(private readonly store: EditorStore) {}

  execute(draft: ReviewNoteDraft): ReviewNote | null {
    const text = draft.text.trim().slice(0, REVIEW_NOTE_MAX_TEXT_LENGTH);
    if (text === '') return null;
    const notes = this.store.snapshot().reviewNotes;
    const note: ReviewNote = {
      id: crypto.randomUUID(),
      number: notes.nextNumber(),
      createdAt: new Date(),
      sourceSec: Math.max(0, draft.sourceSec),
      place: draft.place,
      refs: draft.refs,
      quote: draft.quote,
      text,
      status: 'draft',
      batchId: null,
    };
    this.store.commit('Add note');
    this.store.patch({ reviewNotes: notes.adding(note) });
    return note;
  }
}
