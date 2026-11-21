import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ReviewNotesOnFrame } from '@presentation/review-notes/services/ReviewNotesOnFrame';
import type { ReviewMarkingStore } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { useEditorCuts, useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useReviewNotes } from '@ui/pages/editor/features/review-notes/hooks/useReviewNotes';
import { REVIEW_TOUCH_TARGET } from '@ui/pages/editor/features/review-notes/review-notes-classes';

const onFrame = new ReviewNotesOnFrame();

/** The scrubber's thumb, as CustomVideoControls.css draws it. */
const THUMB_PX = 12;

const MARK =
  'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-surface-1 cursor-pointer pointer-events-auto '
  + 'transition-colors duration-quick ease-standard hover:bg-accent-hover '
  + `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${REVIEW_TOUCH_TARGET}`;

/**
 * The notes along the scrubber, each a dot at its moment in the export:
 * full while one there is not sent yet, fainter once sent. A dot takes
 * the playhead to its note and opens it.
 */
export function ReviewTimelineMarks({ store }: { store: ReviewMarkingStore }) {
  const editorStore = useEditorStore();
  const playback = usePlayback();
  const notes = useReviewNotes();
  const cuts = useEditorCuts();
  const subscribe = useCallback((notify: () => void) => {
    editorStore.addEventListener('change', notify);
    return () => editorStore.removeEventListener('change', notify);
  }, [editorStore]);
  const durationSec = useSyncExternalStore(subscribe, () => editorStore.snapshot().video.duration);
  const marks = useMemo(() => onFrame.timelineMarks(notes, cuts, durationSec), [notes, cuts, durationSec]);
  if (marks.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" aria-label="Notes">
      {marks.map(({ notes: atMark, share }) => {
        const first = atMark[0]!;
        const numbers = atMark.map((note) => note.number).join(', ');
        const waiting = atMark.some((note) => note.status === 'draft');
        return (
          <button
            key={first.id}
            type="button"
            className={`${MARK} ${waiting ? 'bg-accent' : 'bg-accent/50'}`}
            // The thumb's centre travels between half a thumb from each end, so a dot does too.
            style={{ left: `calc(${THUMB_PX / 2}px + ${share} * (100% - ${THUMB_PX}px))` }}
            onClick={() => {
              playback.pause();
              playback.seek(first.sourceSec);
              store.openNote(first.id);
            }}
            aria-label={atMark.length === 1 ? `Go to note ${first.number}` : `Go to notes ${numbers}`}
            title={atMark.map((note) => `Note ${note.number}: ${note.text}`).join('\n')}
          />
        );
      })}
    </div>
  );
}
