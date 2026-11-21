import { memo, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { EMPTY_LINE_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { AnchoredSoundList } from '@ui/pages/editor/features/audio/components/AnchoredSoundList';
import { SoundPickerPopover } from '@ui/pages/editor/features/audio/components/SoundPickerPopover';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';

interface WordSoundPanelProps {
  /** A word of the Original track. */
  wordId: string;
}

/**
 * The sound effects a word plays as it is said, the same ones its
 * popover lists: each with its level, nudge and removal, and a button
 * that picks one more. Each pick is one undo step.
 */
export const WordSoundPanel = memo(function WordSoundPanel({ wordId }: WordSoundPanelProps) {
  const { actions } = useAudioMix();
  const { projectId } = useEditorState();
  const mix = useEditorAudioMix();
  const presenter = useAnchoredSoundsPresenter();
  const anchor = useMemo(() => presenter.wordAnchor(wordId), [presenter, wordId]);
  const hasSounds = presenter.soundCountOn(mix, anchor) > 0;
  return (
    <Section title="Sounds">
      {hasSounds
        ? <AnchoredSoundList anchor={anchor} />
        : <p className={EMPTY_LINE_CLASS}>A sound added here plays as the word is said, and follows it when the words change.</p>}
      <div>
        <SoundPickerPopover
          mode="effect"
          projectId={projectId}
          pickLabel="Add"
          onPick={(source) => actions.addClips.execute([presenter.effectDraft(anchor, source)])}
          trigger={(
            <button type="button" className={BTN_SECONDARY_SM}>
              <Plus size={14} /> {hasSounds ? 'Add another sound' : 'Add sound'}
            </button>
          )}
        />
      </div>
    </Section>
  );
});
