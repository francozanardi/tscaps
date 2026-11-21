import type { HistoryAuthor } from '@core/editor/domain/HistoryCheckpoint';

/**
 * Says who makes the changes being made right now: the author of the
 * history group open at this moment, or null when none is open (a change
 * made then is the person's own, one checkpoint each).
 */
export interface HistoryGroupAuthorReader {
  readonly historyGroupAuthor: HistoryAuthor | null;
}
