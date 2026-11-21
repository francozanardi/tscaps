import { useMemo } from 'react';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { SoundPicker } from '@ui/pages/editor/features/audio/components/SoundPicker';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';

interface ShotTransitionSoundScreenProps {
  shotId: string;
  projectId: string | null;
}

/** Picks a sound for the transition into a shot: placed on the transition, then back to it. */
export function ShotTransitionSoundScreen({ shotId, projectId }: ShotTransitionSoundScreenProps) {
  const { actions } = useAudioMix();
  const presenter = useAnchoredSoundsPresenter();
  const { back } = usePopoverNav();
  const anchor = useMemo(() => presenter.transitionAnchor(shotId), [presenter, shotId]);
  return (
    // Held to the room the popover has, so its title stays on screen and the list scrolls instead.
    <div className="flex flex-col pt-2 max-h-[var(--radix-popover-content-available-height)]">
      <div className="shrink-0 px-2 pb-1">
        <PopoverHeader title="Sound on the cut" />
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
