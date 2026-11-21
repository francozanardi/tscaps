import { useCallback, useMemo } from 'react';
import type { ReviewMarkingStore, ReviewTool } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useReviewMarking } from '@ui/pages/editor/features/review-notes/hooks/useReviewMarking';
import { useReviewMarkingByTouch } from '@ui/pages/editor/features/review-notes/hooks/useReviewMarkingByTouch';

/** A way into marking from outside the frame. */
export interface ReviewMarkingToggle {
  /** Whether the frame is being marked. */
  readonly active: boolean;
  /** Whether the tools are offered over the frame, none picked yet. */
  readonly choosing: boolean;
  /** The tool marking with, while marking; null otherwise. */
  readonly tool: ReviewTool | null;
  /** What pressing it does, for its tooltip and its name. */
  readonly label: string;
  /** Pauses the video and offers the tools over the frame; puts them away, or leaves marking, when on. */
  readonly toggle: () => void;
}

/**
 * Marking started from somewhere other than the frame's own tools, for
 * where those cannot be found (`useReviewMarkingByTouch`): null anywhere
 * else, where the tools show over the frame on hover.
 */
export function useReviewMarkingToggle(store: ReviewMarkingStore): ReviewMarkingToggle | null {
  const byTouch = useReviewMarkingByTouch();
  const { active, choosing, tool } = useReviewMarking(store);
  const playback = usePlayback();
  const toggle = useCallback(() => {
    const snapshot = store.snapshot();
    if (snapshot.active || snapshot.choosing) {
      store.stop();
      return;
    }
    playback.pause();
    store.offerTools();
  }, [store, playback]);
  return useMemo(() => {
    if (!byTouch) return null;
    const label = active ? 'Stop marking the video' : choosing ? 'Put the marking tools away' : 'Mark what to change on the video';
    return { active, choosing, tool: active ? tool : null, label, toggle };
  }, [byTouch, active, choosing, tool, toggle]);
}
