import type { HistoryAuthor } from '@core/editor/domain/HistoryCheckpoint';

/**
 * A run of changes folded into one checkpoint: `key` names the run, and
 * `author` says who makes it.
 */
export interface HistoryGroup {
  readonly key: string;
  readonly author: HistoryAuthor;
}
