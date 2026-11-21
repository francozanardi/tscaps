import { memo, useMemo } from 'react';
import type { Document } from '@tscaps/engine';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { MusicSection } from '@ui/pages/editor/features/audio/components/MusicSection';
import { SoundEffectsSection } from '@ui/pages/editor/features/audio/components/SoundEffectsSection';
import { VideoSoundSection } from '@ui/pages/editor/features/audio/components/VideoSoundSection';
import { useAudioTabPresenter } from '@ui/pages/editor/features/audio/hooks/useAudioTabPresenter';
import { useAudioTimingContext } from '@ui/pages/editor/features/audio/hooks/useAudioTimingContext';

interface AudioTabProps {
  /** The Original track's words, whatever caption track is active: sounds on words follow what is said. */
  originalDocument: Document | null;
  /** The sheets the Original track's sections route to, and its emoji edits: sounds on emojis play while they show. */
  originalSheets: ReadonlyArray<Sheet>;
  originalDecorationOverrides: DecorationOverrideRegistry;
  shots: ShotPartition;
  videoDurationSec: number;
  projectId: string | null;
}

/**
 * What the video sounds like: the music under it, the level of its own
 * sound, and every sound effect placed on it, in the order they play.
 * Effects are added where they are anchored — on a word, a shot or a
 * layer — and found again here, where an effect that makes no sound
 * says why.
 */
export const AudioTab = memo(function AudioTab(props: AudioTabProps) {
  const { originalDocument, originalSheets, originalDecorationOverrides, shots, videoDurationSec, projectId } = props;
  const audio = useEditorAudioMix();
  const presenter = useAudioTabPresenter();
  const original = { document: originalDocument, sheets: originalSheets, decorationOverrides: originalDecorationOverrides };
  const context = useAudioTimingContext(original, shots, videoDurationSec);
  const music = presenter.musicOf(audio);
  const rows = useMemo(() => presenter.effectRows(audio, context), [presenter, audio, context]);

  return (
    <EditorTab title="Audio" hideTitleRow>
      <MusicSection music={music} media={context.media} presenter={presenter} projectId={projectId} />
      <VideoSoundSection sourceVolume={audio.sourceVolume} presenter={presenter} />
      <SoundEffectsSection rows={rows} presenter={presenter} projectId={projectId} context={context} />
    </EditorTab>
  );
});
