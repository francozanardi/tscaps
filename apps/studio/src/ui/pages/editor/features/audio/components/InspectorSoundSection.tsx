import { memo, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { AudioEffectRow, AudioTabPresenter, SectionEffectRow } from '@presentation/audio-mix/services/AudioTabPresenter';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { SoundEffectRow, type SoundEffectGoTo } from '@ui/pages/editor/features/audio/components/SoundEffectRow';
import { SoundPickerPopover } from '@ui/pages/editor/features/audio/components/SoundPickerPopover';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useClipAudition } from '@ui/pages/editor/features/audio/hooks/useClipAudition';
import { useSoundEffectPlayback } from '@ui/pages/editor/features/audio/hooks/useSoundEffectPlayback';

interface InspectorSoundSectionProps {
  title: string;
  /** The sounds that play at this part of the element's life, its own first. */
  rows: readonly SectionEffectRow[];
  presenter: AudioTabPresenter;
  projectId: string | null;
  /** What anchors are read against: an effect moved to the playhead is placed against the nearest of them. */
  context: AudioTimingContext;
  /** Where *Add sound* puts a sound; null where the section adds none, and is left out while it lists none. */
  addAnchor: AudioAnchor | null;
  /** Where a sound that is not the section's own comes from, as a button that goes there; null where there is nowhere to go. */
  goToOf: (row: AudioEffectRow) => SoundEffectGoTo | null;
}

/**
 * One part of an element's life on its sound page (a shot's start, a
 * layer's entrance), with every sound that plays there: its own, added
 * here, then those something else plays there (a camera, a transition, a
 * word), each saying what plays it and offering to go there. Every row
 * is the sound itself, so a change or a removal here is one there too.
 */
export const InspectorSoundSection = memo(function InspectorSoundSection({
  title,
  rows,
  presenter,
  projectId,
  context,
  addAnchor,
  goToOf,
}: InspectorSoundSectionProps) {
  const clips = useMemo(() => rows.map(({ row }) => row.clip), [rows]);
  const audition = useClipAudition(clips);
  const playInVideo = useSoundEffectPlayback();
  const auditionRow = useCallback((row: AudioEffectRow) => audition.toggle(row.clip), [audition]);
  const store = useEditorStore();
  const { actions } = useAudioMix();
  const anchors = useAnchoredSoundsPresenter();
  // Read when pressed, so the list does not re-render on every tick of the playhead.
  const moveToPlayhead = useCallback((clipId: string) => {
    const outputSec = context.timeMap.toOutputTime(store.snapshot().video.currentTime);
    actions.patchClips.execute([clipId], { start: presenter.pointAtPlayhead(context, outputSec) });
  }, [presenter, context, store, actions]);
  if (rows.length === 0 && addAnchor === null) return null;
  return (
    <Section title={title}>
      <div className="flex flex-col gap-2">
        {rows.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col" aria-label={`${title} sounds`}>
            {rows.map(({ row, own }) => (
              <SoundEffectRow
                key={row.clip.id}
                row={row}
                presenter={presenter}
                projectId={projectId}
                isPlaying={audition.isPlaying(row.clip)}
                onAudition={auditionRow}
                onPlayInVideo={playInVideo}
                onMoveToPlayhead={moveToPlayhead}
                hidesAnchor={own}
                goTo={own ? null : goToOf(row)}
              />
            ))}
          </ul>
        )}
        {addAnchor !== null && (
          <SoundPickerPopover
            mode="effect"
            projectId={projectId}
            pickLabel="Add"
            onPick={(source) => actions.addClips.execute([anchors.effectDraft(addAnchor, source)])}
            trigger={<button type="button" className={`${BTN_SECONDARY_SM} self-start`}><Plus size={14} /> Add sound</button>}
          />
        )}
      </div>
    </Section>
  );
});
