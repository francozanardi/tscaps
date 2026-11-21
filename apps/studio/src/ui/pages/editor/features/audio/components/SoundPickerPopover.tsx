import { useState, type ReactElement, type ReactNode } from 'react';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { SoundPickerMode } from '@presentation/audio-mix/services/SoundPickerPresenter';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { SoundPicker } from '@ui/pages/editor/features/audio/components/SoundPicker';

interface SoundPickerPopoverProps {
  /** A DOM-forwarding element that opens the picker. */
  trigger: ReactElement;
  mode: SoundPickerMode;
  projectId: string | null;
  pickLabel: string;
  onPick: (source: AudioSourceRef) => void;
  /** Shown above the picker, for a choice the pick is made under (where the sound goes, say). None by default. */
  header?: ReactNode;
}

/**
 * The sound picker, opened from a button; it closes on a pick, and what
 * it plays stops with it. It opens with focus on itself rather than on
 * its first sound, which would light that entry as if it were chosen.
 */
export function SoundPickerPopover({ trigger, mode, projectId, pickLabel, onPick, header }: SoundPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const pick = (source: AudioSourceRef) => {
    onPick(source);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      focusOnOpen="popover"
      screens={{
        picker: header === undefined
          ? <SoundPicker mode={mode} projectId={projectId} pickLabel={pickLabel} onPick={pick} />
          : (
            <div className="flex flex-col min-h-0">
              {header}
              <SoundPicker mode={mode} projectId={projectId} pickLabel={pickLabel} onPick={pick} />
            </div>
          ),
      }}
    />
  );
}
