import { memo, useMemo } from 'react';
import { AudioLines, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { FieldLabel } from '@ui/_shared/components/controls/fields/FieldLabel';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { ROW_ICON_BUTTON_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { SoundPickerPopover } from '@ui/pages/editor/features/audio/components/SoundPickerPopover';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { FIELD_ROW_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotLayerSoundFieldsProps {
  /** Where the sound plays, one anchor per layer edited (its entry, say, or its split line's slide). Never empty. */
  anchors: readonly AudioAnchor[];
  /** Whether the sound may be moved off its anchor: a layer's edge, yes; a transition's middle, which follows its length, no. */
  offsets: boolean;
  projectId: string | null;
}

const PICKED_SOUND_CLASS =
  'flex-1 min-w-0 h-8 px-2 inline-flex items-center gap-2 rounded-xs border border-edge-medium bg-surface-1 '
  + 'text-xs text-fg-primary text-left cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent';

/**
 * The sound shot layers play at one spot (as they enter or exit, or as
 * their layout's transition moves): a picker, the level, where offered
 * how far before or after the spot it plays (negative is earlier), and a
 * button that removes it. A pick gives every layer the sound, each
 * keeping the level its old one had; every change reaches all of them
 * in one undo step. Where the layers differ the first one's sound and
 * level show, marked *Mixed*.
 */
export const ShotLayerSoundFields = memo(function ShotLayerSoundFields({ anchors, offsets, projectId }: ShotLayerSoundFieldsProps) {
  const { actions } = useAudioMix();
  const mix = useEditorAudioMix();
  const media = useMediaAssets();
  const presenter = useAnchoredSoundsPresenter();
  const sound = useMemo(() => presenter.sharedSound(mix, anchors, media), [presenter, mix, anchors, media]);
  const pick = (source: AudioSourceRef) => {
    const change = presenter.sharedSoundChange(mix, anchors, source);
    actions.addClips.execute(change.drafts, change.replacedClipIds);
  };
  const hasSound = sound.name !== null;
  const offsetBounds = presenter.layerOffsetBounds();

  return (
    <>
      <div className={FIELD_ROW_CLASS}>
        <div className="flex items-center gap-2">
          <FieldLabel label="Sound" mixed={sound.isNameMixed} />
          <SoundPickerPopover
            mode="effect"
            projectId={projectId}
            pickLabel={hasSound ? 'Use' : 'Add'}
            onPick={pick}
            trigger={hasSound ? (
              <button type="button" className={PICKED_SOUND_CLASS} aria-label="Change sound">
                <AudioLines size={13} className="shrink-0 text-fg-muted" />
                <span className="flex-1 min-w-0 truncate">{sound.name}</span>
                <ChevronDown size={13} className="shrink-0 text-fg-faint" />
              </button>
            ) : (
              <button type="button" className={BTN_SECONDARY_SM}><Plus size={14} /> Add sound</button>
            )}
          />
          {hasSound && (
            <Tooltip text="Remove sound">
              <button
                type="button"
                className={ROW_ICON_BUTTON_CLASS}
                aria-label="Remove sound"
                onClick={() => actions.removeClips.execute(sound.clipIds)}
              >
                <Trash2 size={13} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      {hasSound && (
        <div className={FIELD_ROW_CLASS}>
          <Slider
            label="Volume"
            mixed={sound.isVolumeMixed}
            value={sound.volumePercent}
            min={0}
            max={200}
            step={1}
            unit="%"
            onChange={(percent) => actions.patchClips.execute(sound.clipIds, { volume: presenter.gainOf(percent) })}
          />
        </div>
      )}
      {hasSound && offsets && (
        <div className={FIELD_ROW_CLASS}>
          <Slider
            label="Offset"
            mixed={sound.isOffsetMixed}
            value={sound.offsetSec}
            min={offsetBounds.minSec}
            max={offsetBounds.maxSec}
            step={offsetBounds.stepSec}
            unit="s"
            onChange={(seconds) => actions.patchClips.execute(sound.clipIds, { startOffsetSec: seconds })}
          />
        </div>
      )}
    </>
  );
});
