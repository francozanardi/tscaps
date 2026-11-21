import { useMemo, type ReactNode } from 'react';
import type { ReviewMarkingStore } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { ReviewFrameLayer } from '@ui/pages/editor/features/review-notes/components/ReviewFrameLayer';
import { ReviewTimelineMarks } from '@ui/pages/editor/features/review-notes/components/ReviewTimelineMarks';

/** What the editor shows of review notes, slot by slot; all empty where notes are not offered. */
export interface ReviewNotesSlots {
  /** Over the frame, covering it exactly: the marking tools, the notes and their bubbles. */
  readonly frameLayer: ReactNode;
  /** Over the scrubber, covering it exactly. */
  readonly timelineOverlay: ReactNode;
}

const NOT_OFFERED: ReviewNotesSlots = { frameLayer: undefined, timelineOverlay: undefined };

/**
 * Fills the editor's slots with review notes when `offered` (something
 * reads the batches they are sent in), marked through `store`, which a
 * way into marking from outside the frame shares (`useReviewMarkingToggle`).
 * `onNoteAdded` is told where on screen each new note's pin landed.
 */
export function useReviewNotesSlots(store: ReviewMarkingStore, offered: boolean, onNoteAdded?: (from: DOMRect) => void): ReviewNotesSlots {
  const slots = useMemo((): ReviewNotesSlots => ({
    frameLayer: <ReviewFrameLayer store={store} onNoteAdded={onNoteAdded} />,
    timelineOverlay: <ReviewTimelineMarks store={store} />,
  }), [store, onNoteAdded]);
  return offered ? slots : NOT_OFFERED;
}
