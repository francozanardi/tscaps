import { useCallback } from 'react';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';
import { useKeymap } from '@ui/_shared/hooks/useKeymap';

const chordReader = new KeyChordReader();

/**
 * Asks whether a keydown presses one of a command's chords, for the few
 * commands a focused field carries out itself because only the field
 * knows the text and the caret they act on.
 */
export function useShortcutMatcher(): (commandId: ShortcutCommandId, event: KeyboardEvent) => boolean {
  const keymap = useKeymap();
  return useCallback((commandId: ShortcutCommandId, event: KeyboardEvent) => {
    const chord = chordReader.read(event);
    if (!chord) return false;
    return keymap.chordsFor(commandId).some((candidate) => candidate.equals(chord));
  }, [keymap]);
}
