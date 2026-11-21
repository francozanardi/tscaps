import { memo, useMemo } from 'react';
import type { SoundPageOwner } from '@presentation/audio-mix/services/SoundOriginDestinations';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { InspectorSoundSection } from '@ui/pages/editor/features/audio/components/InspectorSoundSection';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useAudioTabPresenter } from '@ui/pages/editor/features/audio/hooks/useAudioTabPresenter';
import { useAudioTimingContext } from '@ui/pages/editor/features/audio/hooks/useAudioTimingContext';
import { useSoundOriginGoTo } from '@ui/pages/editor/features/audio/hooks/useSoundOriginGoTo';
import { ShotVideoSoundSection } from '@ui/pages/editor/features/shots/components/ShotVideoSoundSection';

interface ShotSoundPanelProps {
  shotId: string;
}

const NO_ROWS: readonly never[] = [];

/**
 * What a shot sounds like: how loud the video's own sound plays during
 * it, then every sound of the shot by when it plays. *Start* and *End*
 * hold the sounds added on them, and *Start* also its camera's and the
 * transition into it's; *During* holds the rest of the shot's (its
 * words', its layers'), and shows only while there is one. Every sound
 * is changed or removed in place; one played by something else says
 * what plays it and, where it can, takes the user there.
 */
export const ShotSoundPanel = memo(function ShotSoundPanel({ shotId }: ShotSoundPanelProps) {
  const state = useEditorState();
  const { services } = useShots();
  const audio = useEditorAudioMix();
  const presenter = useAudioTabPresenter();
  const anchors = useAnchoredSoundsPresenter();
  const original = services.originalCaptions.read(state);
  const originalDocument = original.document;
  const context = useAudioTimingContext(original, state.shots, state.video.duration);
  // A shot still only proposed is listed as the shots panel lists it.
  const shot = useMemo(
    () => services.resolver.resolve(services.materializer.materializeFrom(state), originalDocument, state.video.duration)
      .find((resolved) => resolved.id === shotId) ?? null,
    [services, state, originalDocument, shotId],
  );
  const sections = useMemo(
    () => (shot === null ? null : presenter.shotSoundSections(audio, context, shot)),
    [presenter, audio, context, shot],
  );
  const owner = useMemo<SoundPageOwner>(() => ({ kind: 'shot', shotId }), [shotId]);
  const goToOf = useSoundOriginGoTo(owner);
  const startAnchor = useMemo(() => anchors.shotAnchor(shotId, 'start'), [anchors, shotId]);
  const endAnchor = useMemo(() => anchors.shotAnchor(shotId, 'end'), [anchors, shotId]);
  const shared = { presenter, projectId: state.projectId, context, goToOf };
  return (
    <>
      <ShotVideoSoundSection shotId={shotId} />
      <InspectorSoundSection title="Start" rows={sections?.start ?? NO_ROWS} addAnchor={startAnchor} {...shared} />
      <InspectorSoundSection title="During" rows={sections?.during ?? NO_ROWS} addAnchor={null} {...shared} />
      <InspectorSoundSection title="End" rows={sections?.end ?? NO_ROWS} addAnchor={endAnchor} {...shared} />
    </>
  );
});
