import { useCallback, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { Segment } from '@tscaps/engine';
import { CharOwnership } from '@core/editor/captions/domain/CharOwnership';
import { CharLevelDiffer } from '@core/editor/captions/services/CharLevelDiffer';

const differ = new CharLevelDiffer();

export interface SceneEditorCallbacks {
  smartEdit: (args: { segmentId: string; text: string; ownership: CharOwnership }) => void;
  splitAtCursor: (args: { segmentId: string; text: string; ownership: CharOwnership; cursorPos: number }) => void;
  mergeWithSibling: (args: { segmentId: string; text: string; ownership: CharOwnership; direction: 'prev' | 'next' }) => void;
}

export interface SceneEditorHandles {
  readonly value: string;
  readonly textareaRef: React.RefObject<HTMLTextAreaElement>;
  readonly onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
}

/**
 * Local text + char-ownership for one scene's textarea. Each keystroke
 * diffs against the previous text and fires `smartEdit`. Shortcuts:
 * `Ctrl+Enter` splits at cursor, `Backspace` at pos 0 merges with prev,
 * `Delete` at text end merges with next.
 */
export function useSceneEditor(
  segment: Segment,
  callbacks: SceneEditorCallbacks,
): SceneEditorHandles {
  const seed = useCallback(() => CharOwnership.fromSegment(segment), [segment]);

  const [value, setValue] = useState<string>(() => seed().text);
  const ownershipRef = useRef<CharOwnership>(seed().ownership);
  const focusedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Skip re-seed only when value and model agree modulo whitespace —
  // the recompiler strips trailing/intermediate whitespace from the
  // user's in-progress edit. Any other divergence (merge, split, undo,
  // structural change) re-seeds. Layout phase so post-merge re-seeds
  // run before the parent restores focus to this textarea.
  useLayoutEffect(() => {
    const next = seed();
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    if (focusedRef.current && norm(value) === norm(next.text)) return;
    ownershipRef.current = next.ownership;
    setValue(next.text);
  }, [seed, value]);

  const onChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const prev = value;
    if (prev === next) return;
    const edits = differ.diff(prev, next);
    const nextOwnership = ownershipRef.current.applyDelta(edits);
    ownershipRef.current = nextOwnership;
    setValue(next);
    callbacks.smartEdit({ segmentId: segment.id, text: next, ownership: nextOwnership });
  }, [callbacks, segment.id, value]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const ta = e.currentTarget;
      const cursor = ta.selectionStart;
      callbacks.splitAtCursor({
        segmentId: segment.id,
        text: value,
        ownership: ownershipRef.current,
        cursorPos: cursor,
      });
      // This textarea continues to host the first half — sync local
      // state so the second half's text doesn't linger here. Caret
      // restoration on the new second-half textarea is handled by the
      // parent (CaptionsTab) once the post-split render commits.
      const newText = value.slice(0, cursor).replace(/\s+$/, '');
      const newMapping = ownershipRef.current.mapping.slice(0, newText.length);
      ownershipRef.current = new CharOwnership(newMapping);
      setValue(newText);
      return;
    }
    if (e.key === 'Backspace' && !e.shiftKey && !e.altKey) {
      const ta = e.currentTarget;
      if (ta.selectionStart === 0 && ta.selectionEnd === 0) {
        e.preventDefault();
        callbacks.mergeWithSibling({
          segmentId: segment.id,
          text: value,
          ownership: ownershipRef.current,
          direction: 'prev',
        });
        return;
      }
    }
    if (e.key === 'Delete' && !e.shiftKey && !e.altKey) {
      const ta = e.currentTarget;
      if (ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length) {
        e.preventDefault();
        callbacks.mergeWithSibling({
          segmentId: segment.id,
          text: value,
          ownership: ownershipRef.current,
          direction: 'next',
        });
        return;
      }
    }
  }, [callbacks, segment.id, value]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
  }, []);

  return { value, textareaRef, onChange, onKeyDown, onFocus, onBlur };
}
