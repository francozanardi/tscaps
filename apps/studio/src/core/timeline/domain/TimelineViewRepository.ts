import type { TimelineView } from '@core/timeline/domain/TimelineView';

/** Remembers the level the reader last chose to read the timeline at. */
export interface TimelineViewRepository {
  /** `null` when nothing was ever chosen, or when storage cannot be read. */
  load(): TimelineView | null;
  save(view: TimelineView): void;
}
