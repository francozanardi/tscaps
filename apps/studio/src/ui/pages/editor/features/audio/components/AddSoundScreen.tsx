import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { SoundPicker } from '@ui/pages/editor/features/audio/components/SoundPicker';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';

interface AddSoundScreenProps {
  title: string;
  /** What the sound picked is put on. */
  anchor: AudioAnchor;
  projectId: string | null;
}

/**
 * A popover screen that picks a sound effect for one anchor. Picking
 * adds it there, as one undo step, and goes back to the screen this one
 * was opened from, which lists it.
 */
export function AddSoundScreen({ title, anchor, projectId }: AddSoundScreenProps) {
  const { back } = usePopoverNav();
  const { actions } = useAudioMix();
  const presenter = useAnchoredSoundsPresenter();
  return (
    <div className="flex flex-col pt-2">
      <div className="px-2 pb-1">
        <PopoverHeader title={title} />
      </div>
      <SoundPicker
        mode="effect"
        projectId={projectId}
        pickLabel="Add"
        onPick={(source) => {
          actions.addClips.execute([presenter.effectDraft(anchor, source)]);
          back();
        }}
      />
    </div>
  );
}
