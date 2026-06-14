import { useMemo } from 'react';
import type { CharOwnership } from '@core/captions/domain/CharOwnership';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';

export interface CaptionsCallbacks {
  smartEdit: (args: { segmentId: string; text: string; ownership: CharOwnership }) => void;
  splitAtCursor: (args: { segmentId: string; text: string; ownership: CharOwnership; cursorPos: number }) => void;
  mergeWithSibling: (args: { segmentId: string; text: string; ownership: CharOwnership; direction: 'prev' | 'next' }) => void;
  editSegmentTime: (args: { segmentId: string; start: number; end: number }) => void;
  editWordTime: (wordId: string, start: number, end: number) => void;
  redistributeWords: (segmentId: string) => void;
}

/**
 * Captions-panel callbacks read straight from the editor module. The
 * shape mirrors the textarea-driven editing surface (smart edit on
 * keystroke, split / merge shortcuts, time adjustments). Stable as
 * long as the editor module reference is — re-creating the object
 * doesn't churn memoized consumers.
 */
export function useCaptionsCallbacks(): CaptionsCallbacks {
  const editor = useEditor();
  return useMemo<CaptionsCallbacks>(() => ({
    smartEdit: (args) => editor.actions.segments.applySmartEdit.execute(args),
    splitAtCursor: (args) => editor.actions.segments.splitAtCursor.execute(args),
    mergeWithSibling: (args) => editor.actions.segments.mergeWithSibling.execute(args),
    editSegmentTime: (args) => editor.actions.segments.editTime.execute(args),
    editWordTime: (id, start, end) => editor.actions.words.editTime.execute(id, start, end),
    redistributeWords: (id) => editor.actions.segments.redistributeWords.execute(id),
  }), [editor]);
}
