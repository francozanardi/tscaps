import { memo, useMemo } from 'react';
import { ArrowUpRight, AudioLines } from 'lucide-react';
import { FieldLabel } from '@ui/_shared/components/controls/fields/FieldLabel';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import type { SoundPageOwner } from '@presentation/audio-mix/services/SoundOriginDestinations';
import { InspectorSoundSection } from '@ui/pages/editor/features/audio/components/InspectorSoundSection';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useAudioTabPresenter } from '@ui/pages/editor/features/audio/hooks/useAudioTabPresenter';
import { useAudioTimingContext } from '@ui/pages/editor/features/audio/hooks/useAudioTimingContext';
import { useSoundOriginGoTo } from '@ui/pages/editor/features/audio/hooks/useSoundOriginGoTo';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useFootageSoundPresenter } from '@ui/pages/editor/features/audio/hooks/useFootageSoundPresenter';
import { useElementInspectorTabNav } from '@ui/pages/editor/features/element/ElementInspectorTabNavContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { ShotLayerOwnSoundSection } from '@ui/pages/editor/features/shots/components/ShotLayerOwnSoundSection';
import { ShotLayerSoundFields } from '@ui/pages/editor/features/shots/components/ShotLayerSoundFields';
import { TRANSITION_SOUND_SPOTLIGHT } from '@ui/pages/editor/features/shots/components/ShotLayerTransitionSoundRow';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotLayerSoundPanelProps {
  /** One layer, or several edited together. Never empty. */
  layerIds: readonly string[];
}

const ELSEWHERE_SOUND_CLASS =
  'flex-1 min-w-0 h-8 px-2 inline-flex items-center gap-2 rounded-xs border border-dashed border-edge-medium bg-transparent '
  + 'text-xs text-fg-secondary text-left cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:border-edge-strong hover:text-fg-primary focus-visible:outline-none focus-visible:border-accent';

/**
 * What shot layers sound like: a b-roll's own sound, for the layers
 * showing a video, then the sounds they play at their two edges.
 *
 * One layer lists every sound of each edge, as a shot's page lists its
 * start and end: those added on it (*Add sound*), then those something
 * else plays there, its layout transition's and, as it enters, its
 * camera's, each changed in place and taking the user to the tab that
 * plays it. Between the two, a graphic lists the moments its code
 * declares, each under its name with the sounds added on it; a moment the
 * code no longer declares stays listed while it has sounds, with no way
 * to add more. Several layers edited together show the one sound each
 * edge gives all of them, with the transition's as a row that opens
 * Motion on it.
 */
export const ShotLayerSoundPanel = memo(function ShotLayerSoundPanel({ layerIds }: ShotLayerSoundPanelProps) {
  const { shots } = useEditorState();
  const media = useMediaAssets();
  const footage = useFootageSoundPresenter();
  const videoLayerIds = useMemo(() => footage.videoLayerIdsOf(layerIds, shots, media), [footage, layerIds, shots, media]);
  return (
    <>
      {videoLayerIds.length > 0 && <ShotLayerOwnSoundSection layerIds={videoLayerIds} />}
      {layerIds.length === 1 ? <OneLayerEdgeSounds layerId={layerIds[0]!} /> : <SharedEdgeSounds layerIds={layerIds} />}
    </>
  );
});

/** Every sound of one layer's two edges, its own and what else plays there. */
function OneLayerEdgeSounds({ layerId }: { layerId: string }) {
  const state = useEditorState();
  const { services } = useShots();
  const audio = useEditorAudioMix();
  const presenter = useAudioTabPresenter();
  const anchors = useAnchoredSoundsPresenter();
  const context = useAudioTimingContext(services.originalCaptions.read(state), state.shots, state.video.duration);
  const sections = useMemo(() => presenter.layerSoundSections(audio, context, layerId), [presenter, audio, context, layerId]);
  const owner = useMemo<SoundPageOwner>(() => ({ kind: 'layer', layerId }), [layerId]);
  const goToOf = useSoundOriginGoTo(owner);
  const entryAnchor = useMemo(() => anchors.layerAnchor(layerId, 'entry'), [anchors, layerId]);
  const exitAnchor = useMemo(() => anchors.layerAnchor(layerId, 'exit'), [anchors, layerId]);
  const momentAnchors = useMemo(
    () => sections.moments.map((moment) => (moment.declared ? anchors.layerMomentAnchor(layerId, moment.momentId) : null)),
    [anchors, layerId, sections.moments],
  );
  const shared = { presenter, projectId: state.projectId, context, goToOf };
  return (
    <>
      <InspectorSoundSection title="Entrance" rows={sections.entrance} addAnchor={entryAnchor} {...shared} />
      {sections.moments.map((moment, index) => (
        <InspectorSoundSection
          key={moment.momentId}
          title={moment.label}
          rows={moment.rows}
          addAnchor={momentAnchors[index] ?? null}
          {...shared}
        />
      ))}
      <InspectorSoundSection title="Exit" rows={sections.exit} addAnchor={exitAnchor} {...shared} />
    </>
  );
}

/** The one sound each edge gives every layer edited together, and their transition's. */
function SharedEdgeSounds({ layerIds }: { layerIds: readonly string[] }) {
  const { projectId } = useEditorState();
  const presenter = useAnchoredSoundsPresenter();
  const entryAnchors = useMemo(() => layerIds.map((layerId) => presenter.layerAnchor(layerId, 'entry')), [presenter, layerIds]);
  const exitAnchors = useMemo(() => layerIds.map((layerId) => presenter.layerAnchor(layerId, 'exit')), [presenter, layerIds]);
  return (
    <>
      <Section title="Entrance">
        <div className={FIELD_ROWS_CLASS}>
          <ShotLayerSoundFields anchors={entryAnchors} offsets projectId={projectId} />
          <TransitionSoundRow layerIds={layerIds} edge="entrance" />
        </div>
      </Section>
      <Section title="Exit">
        <div className={FIELD_ROWS_CLASS}>
          <ShotLayerSoundFields anchors={exitAnchors} offsets projectId={projectId} />
          <TransitionSoundRow layerIds={layerIds} edge="exit" />
        </div>
      </Section>
    </>
  );
}

/**
 * The sound the layers' layout transition plays at `edge`, as a row that
 * opens Motion on it; nothing where the transition has none.
 */
function TransitionSoundRow({ layerIds, edge }: { layerIds: readonly string[]; edge: 'entrance' | 'exit' }) {
  const audio = useEditorAudioMix();
  const media = useMediaAssets();
  const presenter = useAnchoredSoundsPresenter();
  const { shots } = useEditorState();
  const nav = useElementInspectorTabNav();
  const anchors = useMemo(() => layerIds.map((layerId) => presenter.layerTransitionAnchor(layerId, edge)), [presenter, layerIds, edge]);
  const sound = useMemo(() => presenter.sharedSound(audio, anchors, media), [presenter, audio, anchors, media]);
  if (sound.name === null) return null;
  const transition = shots.placementOf(layerIds[0]!).kind === 'split' ? 'the split line' : 'the picture in picture';
  return (
    <div className={FIELD_ROW_CLASS}>
      <div className="flex items-center gap-2">
        <FieldLabel label="Transition" mixed={sound.isNameMixed} />
        <Tooltip text={`Plays on ${transition}. Edit it in Motion.`}>
          <button
            type="button"
            className={ELSEWHERE_SOUND_CLASS}
            onClick={() => nav.show('motion', TRANSITION_SOUND_SPOTLIGHT[edge])}
          >
            <AudioLines size={13} className="shrink-0 text-fg-muted" />
            <span className="flex-1 min-w-0 truncate">{sound.name}</span>
            <ArrowUpRight size={13} className="shrink-0 text-fg-faint" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
