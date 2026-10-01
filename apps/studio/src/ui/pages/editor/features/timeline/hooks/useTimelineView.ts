import { useEffect, useState } from 'react';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineViewController } from '@presentation/timeline/controllers/TimelineViewController';

/** Reactive read of the level the timeline is read at. */
export function useTimelineView(controller: TimelineViewController): TimelineView {
  const [view, setView] = useState<TimelineView>(() => controller.view);
  useEffect(() => {
    const update = () => setView(controller.view);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return view;
}
