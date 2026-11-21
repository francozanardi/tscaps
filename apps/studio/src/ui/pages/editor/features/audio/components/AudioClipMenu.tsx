import { useState, type ReactElement, type ReactNode } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { SoundPickerMode } from '@presentation/audio-mix/services/SoundPickerPresenter';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { SoundPicker } from '@ui/pages/editor/features/audio/components/SoundPicker';
import { POPOVER_ITEM, POPOVER_ITEM_DANGER, POPOVER_MENU_SHAPE } from '@ui/pages/editor/features/transcript/transcript-classes';

interface AudioClipMenuProps {
  /** A DOM-forwarding element that opens the menu. */
  trigger: ReactElement;
  /** Which sounds the change offers. */
  mode: SoundPickerMode;
  projectId: string | null;
  /** The item that opens the picker: *Change sound*, *Change music*. */
  changeLabel: string;
  changeIcon: ReactNode;
  onChange: (source: AudioSourceRef) => void;
  onRemove: () => void;
  /** Moves the clip to play at the playhead; absent where the menu does not offer it. */
  onMoveToPlayhead?: (() => void) | undefined;
}

/**
 * What can be done to one clip: play another file in its place, picked
 * in a second screen, move it to play at the playhead where that is
 * offered, or remove it.
 */
export function AudioClipMenu({ trigger, mode, projectId, changeLabel, changeIcon, onChange, onRemove, onMoveToPlayhead }: AudioClipMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      align="end"
      screens={{
        menu: <AudioClipMenuScreen changeLabel={changeLabel} changeIcon={changeIcon} onRemove={onRemove} onMoveToPlayhead={onMoveToPlayhead} />,
        picker: <AudioClipPickerScreen title={changeLabel} mode={mode} projectId={projectId} onChange={onChange} />,
      }}
    />
  );
}

type AudioClipMenuScreenProps = Pick<AudioClipMenuProps, 'changeLabel' | 'changeIcon' | 'onRemove' | 'onMoveToPlayhead'>;

function AudioClipMenuScreen({ changeLabel, changeIcon, onRemove, onMoveToPlayhead }: AudioClipMenuScreenProps) {
  const { navigate, close } = usePopoverNav();
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <button type="button" className={POPOVER_ITEM} onClick={() => navigate('picker')}>
        {changeIcon} {changeLabel}
      </button>
      {onMoveToPlayhead && (
        <button type="button" className={POPOVER_ITEM} onClick={() => { onMoveToPlayhead(); close(); }}>
          <MapPin size={13} /> Move to the playhead
        </button>
      )}
      <button type="button" className={POPOVER_ITEM_DANGER} onClick={() => { onRemove(); close(); }}>
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

interface AudioClipPickerScreenProps {
  title: string;
  mode: SoundPickerMode;
  projectId: string | null;
  onChange: (source: AudioSourceRef) => void;
}

function AudioClipPickerScreen({ title, mode, projectId, onChange }: AudioClipPickerScreenProps) {
  const { close } = usePopoverNav();
  return (
    <div className="flex flex-col pt-2">
      <div className="px-2 pb-1">
        <PopoverHeader title={title} />
      </div>
      <SoundPicker mode={mode} projectId={projectId} pickLabel="Use" onPick={(source) => { onChange(source); close(); }} />
    </div>
  );
}
