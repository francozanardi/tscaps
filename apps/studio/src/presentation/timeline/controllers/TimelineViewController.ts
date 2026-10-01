import type { TimelineViewRepository } from '@core/timeline/domain/TimelineViewRepository';
import { DEFAULT_TIMELINE_VIEW, type TimelineView } from '@core/timeline/domain/TimelineView';

/**
 * The level the timeline is being read at, remembered across sessions.
 *
 * Subscribers listen for `'change'` and read `view`.
 */
export class TimelineViewController extends EventTarget {

  private _view: TimelineView;

  constructor(private readonly repository: TimelineViewRepository) {
    super();
    this._view = repository.load() ?? DEFAULT_TIMELINE_VIEW;
  }

  get view(): TimelineView {
    return this._view;
  }

  show(view: TimelineView): void {
    if (view === this._view) return;
    this._view = view;
    this.repository.save(view);
    this.dispatchEvent(new Event('change'));
  }
}
