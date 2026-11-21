import { memo } from 'react';
import { SoundPickerEntry } from '@ui/pages/editor/features/audio/components/SoundPickerEntry';
import { FIGURE_CLASS } from '@ui/pages/editor/features/audio/audio-classes';

interface SoundPickerBuiltinRowProps {
  name: string;
  /** How long it plays, as read. */
  length: string;
  isPlaying: boolean;
  pickLabel: string;
  onAudition: () => void;
  onPick: () => void;
}

/** A bundled sound in the picker: its name and length, pressed to hear it, and its pick button. */
export const SoundPickerBuiltinRow = memo(function SoundPickerBuiltinRow({ name, length, isPlaying, pickLabel, onAudition, onPick }: SoundPickerBuiltinRowProps) {
  return (
    <SoundPickerEntry name={name} isPlaying={isPlaying} pickLabel={pickLabel} onAudition={onAudition} onPick={onPick}>
      <span className="flex-1 min-w-0 truncate text-xs text-fg-secondary">{name}</span>
      <span className={FIGURE_CLASS}>{length}</span>
    </SoundPickerEntry>
  );
});
