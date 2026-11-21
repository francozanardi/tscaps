import { memo, useCallback, useMemo, useRef } from 'react';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { AudioEffectRow, AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { HeldEffectRowOrder } from '@presentation/audio-mix/services/HeldEffectRowOrder';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { EMPTY_LINE_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { SoundEffectRow } from '@ui/pages/editor/features/audio/components/SoundEffectRow';
import { useClipAudition } from '@ui/pages/editor/features/audio/hooks/useClipAudition';
import { useSoundEffectPlayback } from '@ui/pages/editor/features/audio/hooks/useSoundEffectPlayback';

interface SoundEffectsSectionProps {
  /** Every sound effect, in the order the video plays them. */
  rows: readonly AudioEffectRow[];
  presenter: AudioTabPresenter;
  projectId: string | null;
  /** What anchors are read against: an effect moved to the playhead is placed against the nearest of them. */
  context: AudioTimingContext;
  /** The section's heading; *Sound effects* by default. */
  title?: string;
  /** What it says where there is none; where effects are added, by default. */
  emptyLine?: string;
}

const HELD_ORDER = new HeldEffectRowOrder();

/**
 * Every sound effect of the project, one row each, or one sentence saying
 * where they are added. The rows come in play order when the section is
 * shown and keep their places while it stays on screen, so an effect moved
 * onto another word does not jump away from under the pointer.
 */
export const SoundEffectsSection = memo(function SoundEffectsSection({
  rows: playOrder,
  presenter,
  projectId,
  context,
  title = 'Sound effects',
  emptyLine,
}: SoundEffectsSectionProps) {
  const heldClipIds = useRef<readonly string[]>([]);
  const rows = useMemo(() => {
    const arranged = HELD_ORDER.arrange(heldClipIds.current, playOrder);
    heldClipIds.current = arranged.map((row) => row.clip.id);
    return arranged;
  }, [playOrder]);
  const clips = useMemo(() => rows.map((row) => row.clip), [rows]);
  const audition = useClipAudition(clips);
  const playInVideo = useSoundEffectPlayback();
  const auditionRow = useCallback((row: AudioEffectRow) => audition.toggle(row.clip), [audition]);
  const store = useEditorStore();
  const { actions } = useAudioMix();
  // Read when pressed, so the list does not re-render on every tick of the playhead.
  const moveToPlayhead = useCallback((clipId: string) => {
    const outputSec = context.timeMap.toOutputTime(store.snapshot().video.currentTime);
    actions.patchClips.execute([clipId], { start: presenter.pointAtPlayhead(context, outputSec) });
  }, [presenter, context, store, actions]);
  return (
    <Section title={title} titleAside={rows.length > 0 && <span className="text-2xs text-fg-muted tabular-nums">{rows.length}</span>}>
      {rows.length === 0 ? (
        <p className={EMPTY_LINE_CLASS}>{emptyLine ?? presenter.effectsEmptyLine()}</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col" aria-label="Sound effects">
          {rows.map((row) => (
            <SoundEffectRow
              key={row.clip.id}
              row={row}
              presenter={presenter}
              projectId={projectId}
              isPlaying={audition.isPlaying(row.clip)}
              onAudition={auditionRow}
              onPlayInVideo={playInVideo}
              onMoveToPlayhead={moveToPlayhead}
            />
          ))}
        </ul>
      )}
    </Section>
  );
});
