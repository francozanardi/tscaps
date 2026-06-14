import { useRef, useSyncExternalStore } from 'react';
import type { AlignmentConfig } from '@tscaps/engine';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

interface CacheEntry {
  readonly verticalOffset: number;
  readonly horizontalOffset: number;
  readonly result: AlignmentConfig;
}

/**
 * Returns the preview `AlignmentConfig` to render `wordId` at during
 * an active drag, or `null` when this word is not the one being
 * dragged. While dragging, this hook drives the word's
 * `PositionedWordLayer` to follow the cursor in real time — the
 * caller renders the word at this alignment instead of the saved
 * override. Cached per call site so a stable preview hands back the
 * same object across emits.
 */
export function useWordDragPreview(wordId: string): AlignmentConfig | null {
  const controller = useOverlayManipulationController();
  const cacheRef = useRef<CacheEntry | null>(null);
  return useSyncExternalStore(
    (callback) => controller.subscribe(callback),
    () => {
      const state = controller.snapshot();
      if (!state || state.kind !== 'word' || state.wordId !== wordId) {
        cacheRef.current = null;
        return null;
      }
      const cache = cacheRef.current;
      if (cache
        && cache.verticalOffset === state.verticalOffset
        && cache.horizontalOffset === state.horizontalOffset
      ) {
        return cache.result;
      }
      const result: AlignmentConfig = {
        verticalAlign: 'center',
        verticalOffset: state.verticalOffset,
        horizontalAlign: 'center',
        horizontalOffset: state.horizontalOffset,
      };
      cacheRef.current = {
        verticalOffset: state.verticalOffset,
        horizontalOffset: state.horizontalOffset,
        result,
      };
      return result;
    },
    () => null,
  );
}
