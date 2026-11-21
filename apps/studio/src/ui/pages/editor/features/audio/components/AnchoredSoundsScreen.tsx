import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { AnchoredSoundList } from '@ui/pages/editor/features/audio/components/AnchoredSoundList';
import { SoundPicker } from '@ui/pages/editor/features/audio/components/SoundPicker';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { POPOVER_ITEM } from '@ui/pages/editor/features/transcript/transcript-classes';

interface AnchoredSoundsScreenProps {
  title: string;
  /** What the sounds listed and added are on. */
  anchor: AudioAnchor;
  projectId: string | null;
}

/**
 * A popover screen about the sound effects on one anchor: the picker
 * while there are none, and once there are, each of them with its
 * level, nudge and removal, and a button that opens the picker again
 * for one more. Each pick is one undo step.
 */
export function AnchoredSoundsScreen({ title, anchor, projectId }: AnchoredSoundsScreenProps) {
  const { actions } = useAudioMix();
  const mix = useEditorAudioMix();
  const presenter = useAnchoredSoundsPresenter();
  const hasSounds = presenter.soundCountOn(mix, anchor) > 0;
  // Which half of the screen shows is a view of it, not of the project.
  const [isPicking, setIsPicking] = useState(false);
  const showsPicker = isPicking || !hasSounds;
  return (
    <div className="flex flex-col pt-2">
      <div className="px-2 pb-1">
        <PopoverHeader title={title} />
      </div>
      {showsPicker ? (
        <SoundPicker
          mode="effect"
          projectId={projectId}
          pickLabel="Add"
          onPick={(source) => {
            actions.addClips.execute([presenter.effectDraft(anchor, source)]);
            setIsPicking(false);
          }}
        />
      ) : (
        <div className="w-72 px-2 pb-1 flex flex-col gap-1">
          <AnchoredSoundList anchor={anchor} />
          <button type="button" className={POPOVER_ITEM} onClick={() => setIsPicking(true)}>
            <Plus size={13} /> Add another sound
          </button>
        </div>
      )}
    </div>
  );
}
