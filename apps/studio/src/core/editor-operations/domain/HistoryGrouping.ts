import type { HistoryGroup } from '@core/editor/domain/HistoryGroup';

/**
 * Folds the checkpoints of a run of changes into one. `withHistoryGroup`
 * runs `run`, and every change it commits until it settles joins the
 * checkpoint keyed `group.key`, made by `group.author`; a later group under
 * the same key extends that checkpoint unless another change, an undo, a
 * redo or a jump came in between.
 */
export interface HistoryGrouping {
  withHistoryGroup<T>(group: HistoryGroup, run: () => T | Promise<T>): Promise<T>;
}
