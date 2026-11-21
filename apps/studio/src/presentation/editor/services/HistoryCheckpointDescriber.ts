import type { HistoryCheckpoint, HistoryTimeline } from '@core/editor/domain/HistoryCheckpoint';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Words for the edit history: what a checkpoint is called, the line under
 * it (who, when, how many kinds of edit), the list of its edits when the
 * title does not already say it, and what Undo and Redo would take back
 * or bring back.
 */
export class HistoryCheckpointDescriber {
  titleOf(checkpoint: HistoryCheckpoint): string {
    return checkpoint.parentId === null ? 'Start' : checkpoint.title;
  }

  /** "You · 4 min ago", "Assistant · Just now · 3 kinds of edit"; only the time for the start. */
  metaOf(checkpoint: HistoryCheckpoint, nowMs: number): string {
    const when = this.agoOf(checkpoint.updatedAt, nowMs);
    if (checkpoint.parentId === null) return when;
    const who = checkpoint.author === 'assistant' ? 'Assistant' : 'You';
    const edits = checkpoint.changes.length > 1 ? ` · ${checkpoint.changes.length} kinds of edit` : '';
    return `${who} · ${when}${edits}`;
  }

  /** The checkpoint's edits one per line, or null when its title is its only edit. */
  editsOf(checkpoint: HistoryCheckpoint): string | null {
    if (checkpoint.changes.length === 0) return null;
    if (checkpoint.changes.length === 1 && checkpoint.changes[0] === checkpoint.title) return null;
    return checkpoint.changes.join('\n');
  }

  /** What Undo would take back: the title of the checkpoint shown, or null at the start. */
  undoTitleOf(timeline: HistoryTimeline): string | null {
    const shown = this.find(timeline, timeline.headId);
    return shown === null || shown.parentId === null ? null : shown.title;
  }

  /** What Redo would bring back, or null when there is nothing to redo. */
  redoTitleOf(timeline: HistoryTimeline): string | null {
    const shown = this.find(timeline, timeline.headId);
    if (shown === null || shown.redoChildId === null) return null;
    return this.find(timeline, shown.redoChildId)?.title ?? null;
  }

  private agoOf(atMs: number, nowMs: number): string {
    const elapsed = Math.max(0, nowMs - atMs);
    if (elapsed < MINUTE_MS) return 'Just now';
    if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
    return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  }

  private find(timeline: HistoryTimeline, id: string): HistoryCheckpoint | null {
    return timeline.checkpoints.find((checkpoint) => checkpoint.id === id) ?? null;
  }
}
