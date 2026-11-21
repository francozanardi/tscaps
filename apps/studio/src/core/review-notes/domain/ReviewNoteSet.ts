import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNotesSnapshot } from '@core/review-notes/domain/ReviewNotesSnapshot';
import { ReviewNoteSnapshotReader } from '@core/review-notes/domain/ReviewNoteSnapshotReader';

/**
 * A project's review notes, in the order they were made. Immutable:
 * every change answers a new set, and a change that finds nothing to do
 * answers this one.
 */
export class ReviewNoteSet {
  private constructor(private readonly notes: ReadonlyArray<ReviewNote>) {}

  static empty(): ReviewNoteSet {
    return new ReviewNoteSet([]);
  }

  /** Reads what a project stored, leaving out any note that cannot be read whole. */
  static fromSnapshot(value: unknown): ReviewNoteSet {
    return new ReviewNoteSet(new ReviewNoteSnapshotReader().read(value));
  }

  toSnapshot(): ReviewNotesSnapshot {
    return this.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() }));
  }

  isEmpty(): boolean {
    return this.notes.length === 0;
  }

  list(): ReadonlyArray<ReviewNote> {
    return this.notes;
  }

  /** The notes not sent yet. */
  drafts(): ReadonlyArray<ReviewNote> {
    return this.notes.filter((note) => note.status === 'draft');
  }

  find(id: string): ReviewNote | null {
    return this.notes.find((note) => note.id === id) ?? null;
  }

  findByNumber(number: number): ReviewNote | null {
    return this.notes.find((note) => note.number === number) ?? null;
  }

  /**
   * The number the next note takes: one past the highest. Only drafts
   * are ever removed, so a number that reached anyone is never given again.
   */
  nextNumber(): number {
    return this.notes.reduce((highest, note) => Math.max(highest, note.number), 0) + 1;
  }

  adding(note: ReviewNote): ReviewNoteSet {
    return new ReviewNoteSet([...this.notes, note]);
  }

  /** This set with the note of the same id put in its place; unchanged when there is none. */
  replacing(note: ReviewNote): ReviewNoteSet {
    if (this.find(note.id) === null) return this;
    return new ReviewNoteSet(this.notes.map((held) => (held.id === note.id ? note : held)));
  }

  removing(id: string): ReviewNoteSet {
    if (this.find(id) === null) return this;
    return new ReviewNoteSet(this.notes.filter((note) => note.id !== id));
  }
}
