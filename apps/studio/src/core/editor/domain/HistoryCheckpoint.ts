/** Who made a checkpoint's change: the person in the editor, or the editing assistant. */
export type HistoryAuthor = 'person' | 'assistant';

/**
 * One moment of the edit history: the project as it stood after a change,
 * described for the person. `parentId` names the moment it was made from
 * (null for the start), so checkpoints form a tree: a change made after
 * going back starts a branch, and the moments it replaced stay reachable.
 *
 * `title` says what the change was, in a few words: the title given to
 * it (an assistant turn carries the one the assistant gave it), else its
 * first edit, with how many more it holds ("Change typography + 2 more"). `changes` lists the distinct
 * edits folded into it, in the order first made: a slider dragged for a
 * second is one checkpoint with one change; an assistant turn is one
 * checkpoint with one change per kind of edit it made. `groupKey` names
 * the run of changes it belongs to (an assistant turn), null otherwise.
 * `redoChildId` is the child a redo from it goes to (the one last left,
 * else the one made last), null for a checkpoint with no child. Times are
 * epoch milliseconds.
 */
export interface HistoryCheckpoint {
  readonly id: string;
  readonly parentId: string | null;
  readonly title: string;
  readonly changes: ReadonlyArray<string>;
  readonly author: HistoryAuthor;
  readonly groupKey: string | null;
  readonly redoChildId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * The whole edit history at one moment, immutable: every checkpoint in
 * the order it was made (the start first), the one the editor shows now
 * (`headId`), and the one last saved (`savedId`, null when nothing was
 * saved since the history began).
 */
export interface HistoryTimeline {
  readonly checkpoints: ReadonlyArray<HistoryCheckpoint>;
  readonly headId: string;
  readonly savedId: string | null;
}
