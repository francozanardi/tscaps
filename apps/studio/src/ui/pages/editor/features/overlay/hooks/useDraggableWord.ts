import { useLayoutEffect, type RefObject } from 'react';
import type { Word } from '@tscaps/engine';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

/**
 * Registers the word's span with the manipulation controller so the
 * user can drag it to a new position. The word only renders in one
 * place per render pass (either in its line or in a positioned-word
 * sibling); the binding follows wherever that span lives. `segmentId`
 * is the word's home segment per the document tree — the controller
 * uses it to detect a drop back into the home segment during a drag,
 * which signals "return this detached word to flow".
 */
export function useDraggableWord(word: Word, segmentId: string, spanRef: RefObject<HTMLSpanElement>): void {
  const controller = useOverlayManipulationController();
  useLayoutEffect(() => {
    const span = spanRef.current;
    if (!span) return;
    return controller.bindWord({ wordId: word.id, segmentId, span });
  }, [controller, word.id, segmentId, spanRef]);
}
