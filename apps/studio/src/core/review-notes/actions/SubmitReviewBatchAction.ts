import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ReviewBatch } from '@core/review-notes/domain/ReviewBatch';
import type { ReviewBatchChannel } from '@core/review-notes/services/ReviewBatchChannel';

/**
 * Sends every draft note as one batch, the way a review is submitted:
 * they become sent under a new batch id, and the batch goes out on the
 * channel. Answers the batch, or null when there was no draft, in which
 * case nothing goes out. Not a step of the edit history of its own: a
 * later step keeps the notes as sent, and taking one back brings them
 * back as they were then.
 */
export class SubmitReviewBatchAction {
  constructor(
    private readonly store: EditorStore,
    private readonly channel: ReviewBatchChannel,
  ) {}

  execute(): ReviewBatch | null {
    let notes = this.store.snapshot().reviewNotes;
    const drafts = notes.drafts();
    if (drafts.length === 0) return null;
    const batchId = crypto.randomUUID();
    const sent = drafts.map((note) => ({ ...note, status: 'sent' as const, batchId }));
    for (const note of sent) notes = notes.replacing(note);
    this.store.patch({ reviewNotes: notes, dirty: true });
    const batch: ReviewBatch = { id: batchId, notes: sent };
    this.channel.publish(batch);
    return batch;
  }
}
