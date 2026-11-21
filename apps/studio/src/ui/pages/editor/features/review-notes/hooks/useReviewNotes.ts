import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteSet } from '@core/review-notes/domain/ReviewNoteSet';
import { ReviewNotesOnFrame } from '@presentation/review-notes/services/ReviewNotesOnFrame';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

const onFrame = new ReviewNotesOnFrame();

/** The project's review notes, re-rendering when they change, not on playback ticks. */
export function useReviewNotes(): ReviewNoteSet {
  const store = useEditorStore();
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    return () => store.removeEventListener('change', notify);
  }, [store]);
  return useSyncExternalStore(subscribe, () => store.snapshot().reviewNotes);
}

/**
 * The notes to draw on the frame now: while the video is paused, those
 * at the playhead's moment or a few frames from it; none while it plays.
 * Re-renders only when that list changes, not on every tick.
 */
export function useReviewNotesShown(notes: ReviewNoteSet): ReadonlyArray<ReviewNote> {
  const store = useEditorStore();
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    store.addEventListener('timechange', notify);
    return () => {
      store.removeEventListener('change', notify);
      store.removeEventListener('timechange', notify);
    };
  }, [store]);
  const shownIds = useSyncExternalStore(subscribe, () => {
    const { video } = store.snapshot();
    const shown = video.isPlaying ? [] : onFrame.shownAt(notes, video.currentTime);
    return shown.map((note) => note.id).join(' ');
  });
  return useMemo(() => {
    const ids = new Set(shownIds.split(' '));
    return notes.list().filter((note) => ids.has(note.id));
  }, [notes, shownIds]);
}
