import { useMemo } from 'react';
import type { CharOwnership } from '@core/captions/domain/CharOwnership';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';

export interface TranscriptCallbacks {
  smartEdit: (args: { segmentId: string; text: string; ownership: CharOwnership }) => void;
  splitAtCursor: (args: { segmentId: string; text: string; ownership: CharOwnership; cursorPos: number }) => void;
  mergeWithSibling: (args: { segmentId: string; text: string; ownership: CharOwnership; direction: 'prev' | 'next' }) => void;
  editSegmentTime: (args: { segmentId: string; start: number; end: number }) => void;
  editWordTime: (wordId: string, start: number, end: number) => void;
  redistributeWords: (segmentId: string) => void;
}

/**
 * Captions-panel callbacks read straight from the captions module. The
 * shape mirrors the textarea-driven editing surface (smart edit on
 * keystroke, split / merge shortcuts, time adjustments). Stable as
 * long as the captions module reference is — re-creating the object
 * doesn't churn memoized consumers.
 */
export function useTranscriptCallbacks(): TranscriptCallbacks {
  const captions = useCaptions();
  return useMemo<TranscriptCallbacks>(() => ({
    smartEdit: (args) => captions.actions.segments.applySmartEdit.execute(args),
    splitAtCursor: (args) => captions.actions.segments.splitAtCursor.execute(args),
    mergeWithSibling: (args) => captions.actions.segments.mergeWithSibling.execute(args),
    editSegmentTime: (args) => captions.actions.segments.editTime.execute(args),
    editWordTime: (id, start, end) => captions.actions.words.editTime.execute(id, start, end),
    redistributeWords: (id) => captions.actions.segments.redistributeWords.execute(id),
  }), [captions]);
}
