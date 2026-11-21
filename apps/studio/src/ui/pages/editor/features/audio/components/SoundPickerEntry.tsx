import type { ReactNode } from 'react';
import { Play, Square } from 'lucide-react';

interface SoundPickerEntryProps {
  /** Names the sound for assistive tech. */
  name: string;
  isPlaying: boolean;
  pickLabel: string;
  /** Null where the sound cannot be picked. */
  onPick: (() => void) | null;
  onAudition: () => void;
  /** What the entry shows of the sound, after the play mark. */
  children: ReactNode;
  /** Shown in place of the pick button where the sound cannot be picked. */
  status?: ReactNode;
}

const ENTRY_CLASS =
  'group/entry flex items-center gap-2 mx-1 px-2 rounded-xs transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 focus-within:bg-surface-3';
const PLAYING_CLASS = 'bg-surface-3';
const AUDITION_CLASS =
  'flex flex-1 min-w-0 min-h-8 items-center gap-2 bg-transparent border-none text-left cursor-pointer p-0 '
  + 'focus-visible:outline-none';
const PLAY_MARK_CLASS = 'shrink-0 text-fg-faint group-hover/entry:text-fg-secondary';
// At rest it stays out of the way of the names; on the entry the pointer or the focus is on, it is the one thing to press.
const PICK_CLASS =
  'shrink-0 px-2 py-1 rounded-xs bg-transparent border border-edge-medium text-2xs font-medium text-fg-secondary cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'group-hover/entry:bg-accent group-hover/entry:border-accent group-hover/entry:text-fg-on-accent '
  + 'group-focus-within/entry:bg-accent group-focus-within/entry:border-accent group-focus-within/entry:text-fg-on-accent '
  + 'hover:bg-accent-hover hover:border-accent-hover '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-3';

/**
 * One sound in the picker: pressing it plays it, or stops it while it
 * plays, and its button picks it. The play mark turns to a stop mark,
 * in the accent, while it plays, and the entry stays lit.
 */
export function SoundPickerEntry({ name, isPlaying, pickLabel, onPick, onAudition, children, status }: SoundPickerEntryProps) {
  return (
    <div className={isPlaying ? `${ENTRY_CLASS} ${PLAYING_CLASS}` : ENTRY_CLASS}>
      <button
        type="button"
        className={AUDITION_CLASS}
        aria-label={isPlaying ? `Stop ${name}` : `Play ${name}`}
        aria-pressed={isPlaying}
        onClick={onAudition}
      >
        {isPlaying
          ? <Square size={12} className="shrink-0 text-accent" fill="currentColor" />
          : <Play size={12} className={PLAY_MARK_CLASS} fill="currentColor" />}
        {children}
      </button>
      {onPick !== null ? (
        <button type="button" className={PICK_CLASS} aria-label={`${pickLabel} ${name}`} onClick={onPick}>
          {pickLabel}
        </button>
      ) : status}
    </div>
  );
}
