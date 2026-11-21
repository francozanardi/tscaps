import { useEffect, useRef, type KeyboardEvent } from 'react';
import { REVIEW_NOTE_MAX_TEXT_LENGTH } from '@core/review-notes/domain/ReviewNoteText';
import { useShortcutMatcher } from '@ui/_shared/hooks/useShortcutMatcher';

interface ReviewNoteFieldProps {
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
  /** Enter: keep what is written. */
  onSubmit: () => void;
  /** Escape: leave it. */
  onCancel: () => void;
}

// 16px under a finger: Safari on iOS zooms the page into a field written smaller than that when it is tapped.
const FIELD =
  'block w-full min-h-16 max-h-40 px-2 py-1.5 resize-none text-sm [@media(pointer:coarse)]:text-base leading-relaxed '
  + 'text-fg-primary bg-surface-1 '
  + 'border border-edge-medium rounded-xs outline-none placeholder:text-fg-faint '
  + 'transition-colors duration-quick ease-standard focus-visible:border-accent';

/**
 * Where a note is written. Takes focus when it appears. Enter keeps it,
 * Shift+Enter starts a new line, Escape leaves; undo and redo undo the
 * typing, not the project.
 */
export function ReviewNoteField({ value, placeholder, label, onChange, onSubmit, onCancel }: ReviewNoteFieldProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const matchesShortcut = useShortcutMatcher();

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matchesShortcut('edit.undo', event.nativeEvent) || matchesShortcut('edit.redo', event.nativeEvent)) {
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <textarea
      ref={fieldRef}
      className={FIELD}
      rows={2}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      spellCheck
      maxLength={REVIEW_NOTE_MAX_TEXT_LENGTH}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}
