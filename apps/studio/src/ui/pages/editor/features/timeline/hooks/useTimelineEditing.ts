import { useCallback, useSyncExternalStore } from 'react';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import type {
  TimelineCutEdit,
  TimelineEditingController,
  TimelineSceneEdit,
  TimelineOpenedScene,
  TimelineSceneMove,
  TimelineSelection,
  TimelineWordEdit,
} from '@presentation/timeline/controllers/TimelineEditingController';

/** Reactive read of the current cuts selection (or null). */
export function useTimelineSelection(): TimelineSelection | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.selection,
  );
}

/** Reactive read of the scene the reader has taken hold of (or null). */
export function useTimelineSelectedSceneId(): string | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.selectedSceneId,
  );
}

/** Reactive read of the scene opened word by word (or null). */
export function useTimelineOpenedScene(): TimelineOpenedScene | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.openedScene,
  );
}

/**
 * Reactive read of every scene held — one, or one with every scene after
 * it. Stable by identity until the hold changes.
 */
export function useTimelineHeldSceneIds(): ReadonlySet<string> {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.heldSceneIds,
  );
}

/**
 * Reactive read of the in-progress scene window edit, but only for rows
 * the edit reaches — the union of where the window is and where it is
 * being dragged to, so the row it is leaving hears about it too.
 */
export function useTimelineSceneEditInRow(rowStartSec: number, rowEndSec: number): TimelineSceneEdit | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.sceneEditReaching(rowStartSec, rowEndSec),
  );
}

/**
 * Reactive read of the in-progress scene move, but only for rows it
 * reaches — where the scenes are stored and where they are being taken.
 */
export function useTimelineSceneMoveInRow(rowStartSec: number, rowEndSec: number): TimelineSceneMove | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.sceneMoveReaching(rowStartSec, rowEndSec),
  );
}

/** Reactive read of the in-progress cut edge-drag preview (or null). */
export function useTimelineCutEdit(): TimelineCutEdit | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.cutEdit,
  );
}

/**
 * Reactive read of the in-progress word time edit, but only for rows
 * the edit has anything to say to. Every other row keeps reading `null`
 * and never re-renders, so a word moving under the pointer costs only
 * the rows it actually touches.
 *
 * Both the word's original stretch and the one it is being dragged to
 * count: the first has to stop drawing the word, the second has to
 * start.
 */
/**
 * Reactive read of the in-progress cut resize, but only for rows the
 * edit has anything to say to — the union of where the cut is stored and
 * where it is being dragged to. A row the preview has reached does not
 * hold the stored cut yet, and is the row that would otherwise draw
 * nothing until the gesture is released.
 */
export function useTimelineCutEditInRow(rowStartSec: number, rowEndSec: number): TimelineCutEdit | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.cutEditReaching(rowStartSec, rowEndSec),
  );
}

export function useTimelineWordEditInRow(rowStartSec: number, rowEndSec: number): TimelineWordEdit | null {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.wordEditReaching(rowStartSec, rowEndSec),
  );
}

/**
 * Reactive read of whether a pointer gesture is in flight. Surfaces
 * that would fight the pointer — anything anchored to a range that is
 * still moving — stay hidden while this is true.
 */
export function useTimelineGestureActive(): boolean {
  const controller = useTimelineEditingController();
  return useSyncExternalStore(
    useChangeSubscription(controller),
    () => controller.isGestureActive,
  );
}

function useChangeSubscription(controller: TimelineEditingController) {
  return useCallback((onChange: () => void) => {
    controller.addEventListener('change', onChange);
    return () => controller.removeEventListener('change', onChange);
  }, [controller]);
}
