import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import { useKeyChordLabeler } from '@ui/_shared/hooks/useKeyChordLabeler';

const KEY_CLASS =
  'inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-xs ' +
  'bg-surface-3 border border-edge-subtle font-mono text-2xs leading-none text-fg-secondary';

/** A chord drawn as the keys to press, one cap per key. */
export function KeyChordKeys({ chord }: { chord: KeyChord }) {
  const labeler = useKeyChordLabeler();
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {labeler.keys(chord).map((key, index) => (
        <kbd key={index} className={KEY_CLASS}>{key}</kbd>
      ))}
    </span>
  );
}
