import type { HistoryGroupAuthorReader } from '@core/editor/domain/HistoryGroupAuthorReader';

/**
 * Counts how many times each kind of event was let through, so a reporter
 * can cap what one page load sends: a visitor exploring a grid of cards,
 * or a slider that fires on every step, would otherwise outweigh every
 * other visitor in the data.
 *
 * The person and the editing assistant each have their own count, read
 * from who makes the change open at the moment of the check, so the
 * assistant's edits never spend what measures the person's hand. The
 * count lives as long as the instance, which is meant to be the page
 * load. Keys are the caller's: an event's name for a cap per event, or
 * the name and a value for a cap per value.
 */
export class TelemetryBudget {
  private readonly spent = new Map<string, number>();

  constructor(private readonly authors: HistoryGroupAuthorReader) {}

  /** Whether `key` has been let through fewer than `limit` times for whoever makes the change now; counts this one when it has. */
  allows(key: string, limit: number): boolean {
    const counted = `${this.authors.historyGroupAuthor === 'assistant' ? 'assistant' : 'person'}:${key}`;
    const spent = this.spent.get(counted) ?? 0;
    if (spent >= limit) return false;
    this.spent.set(counted, spent + 1);
    return true;
  }
}
