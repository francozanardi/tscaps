import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import { useKeymap } from '@ui/_shared/hooks/useKeymap';
import { useKeyChordLabeler } from '@ui/_shared/hooks/useKeyChordLabeler';

/**
 * The label of the first chord the command answers to, for a tooltip or
 * a menu hint. `null` when the user left the command without one.
 */
export function useShortcutLabel(commandId: ShortcutCommandId): string | null {
  const keymap = useKeymap();
  const labeler = useKeyChordLabeler();
  const chord = keymap.chordsFor(commandId)[0];
  return chord ? labeler.label(chord) : null;
}
