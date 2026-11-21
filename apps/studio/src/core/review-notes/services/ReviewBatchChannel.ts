import type { ReviewBatch } from '@core/review-notes/domain/ReviewBatch';

export type ReviewBatchListener = (batch: ReviewBatch) => void;

/**
 * Tells whoever waits for the person's notes that a batch was sent.
 * Listeners are called synchronously, in the order they subscribed; a
 * batch sent while nobody listens reaches nobody, and stays readable in
 * the project's notes.
 */
export class ReviewBatchChannel {
  private readonly listeners = new Set<ReviewBatchListener>();

  subscribe(listener: ReviewBatchListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  publish(batch: ReviewBatch): void {
    for (const listener of this.listeners) listener(batch);
  }
}
