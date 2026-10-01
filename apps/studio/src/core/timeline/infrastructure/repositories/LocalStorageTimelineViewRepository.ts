import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import type { TimelineViewRepository } from '@core/timeline/domain/TimelineViewRepository';
import { TIMELINE_VIEWS, type TimelineView } from '@core/timeline/domain/TimelineView';

const KEY = 'timeline-view';

/**
 * localStorage-backed implementation. A stored value this build does not
 * publish — or a corrupted one — reads as nothing chosen, so the default
 * applies.
 */
export class LocalStorageTimelineViewRepository implements TimelineViewRepository {

  constructor(private readonly storage: LocalStorageClient) {}

  load(): TimelineView | null {
    const stored = this.storage.get<unknown>(KEY);
    return TIMELINE_VIEWS.find((view) => view === stored) ?? null;
  }

  save(view: TimelineView): void {
    this.storage.set(KEY, view);
  }
}
