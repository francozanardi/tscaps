import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Loader2, ScanFace } from 'lucide-react';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';
import type { ShotFollowFlowController, ShotFollowFlowState } from '@presentation/shots/controllers/ShotFollowFlowController';
import { ShotFollowShownFrame, type ShownFollowFrame } from '@presentation/shots/services/ShotFollowShownFrame';
import type { VideoFrameSampler } from '@presentation/shots/services/VideoFrameSampler';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { FrameReadingMark } from '@ui/pages/editor/features/shots/components/FrameReadingMark';
import { useShotFrame } from '@ui/pages/editor/features/shots/hooks/useShotFrame';
import { FIELD_ROW_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotFollowSectionProps {
  shotId: string;
  flow: ShotFollowFlowController;
  state: ShotFollowFlowState;
  sampler: VideoFrameSampler;
  /** The stretch of the source the shot's own video is drawn over. */
  stretch: SourceStretch;
  /** The moment of the source whose frame shows where the camera is, while nothing is under way. */
  momentSec: number;
  /** Looks for people on the shot again. */
  onLook: () => void;
  /** How close the camera holds the person, 1 being the frame's own closeness. */
  closeness: number;
  onCloseness: (closeness: number) => void;
}

const HINT = 'm-0 text-2xs text-fg-faint leading-snug';
const STATUS = 'flex items-center gap-2 text-2xs text-fg-muted min-h-5';
// Two lines of hint, the most the status says, so a look begun or answered does not move what is below it.
const STATUS_BOX = 'flex flex-col gap-2 min-h-8';
const PERCENT = 'ml-auto font-mono tabular-nums text-2xs text-fg-faint';
const TRACK = 'h-1 bg-surface-3 rounded-xs overflow-hidden';
const FILL = 'h-full bg-accent transition-[width] duration-base ease-standard';
// The boxes speak the camera picker's language (`ShotCameraFramePicker`): the one in use lit and the rest of the frame
// dimmed around it, the others dashed and lit on hover.
const BOX = 'absolute rounded-sm border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const FOLLOWED_BOX = 'z-10 border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]';
const OFFERED_BOX = 'border-white/60 border-dashed hover:border-white hover:border-solid hover:bg-white/20';
const TAG = 'absolute top-0 left-0 px-1 rounded-br-sm whitespace-nowrap text-2xs font-mono tabular-nums';
const FOLLOWED_TAG = 'bg-accent text-white';
const OFFERED_TAG = 'bg-white/80 text-black';
// The zoom, as a percentage of the frame's own closeness, as far as a camera goes.
const ZOOM_PERCENT = { min: 100, max: 300, step: 5 };

/**
 * What a shot's camera does when it follows a person, picked on a frame
 * of the shot: while people are looked for, where that is; while one is
 * picked, the frame they were seen in with everyone in it; once the shot
 * follows them, a frame of it with what the camera shows there marked,
 * as the export frames it, and on the frame they were picked on everyone
 * else, a click on another following them instead; and how close the
 * camera holds them, which the mark follows. The camera is picked as
 * *Follow* among the others.
 */
export const ShotFollowSection = memo(function ShotFollowSection({
  shotId,
  flow,
  state,
  sampler,
  stretch,
  momentSec,
  onLook,
  closeness,
  onCloseness,
}: ShotFollowSectionProps) {
  const { shots, video, frameLayout, outputFrame } = useEditorState();
  const { services } = useShots();
  const follow = shots.list().find((shot) => shot.id === shotId)?.follow;
  const following = follow !== undefined;
  const shownFrames = useMemo(() => new ShotFollowShownFrame(), []);
  const shown = useMemo(
    () => shownFrames.of(state, following, follow?.picked ?? null, momentSec),
    [shownFrames, state, following, follow, momentSec],
  );
  const camera = useMemo(
    () => (shown?.camera ? services.followStager.viewAt(shots, shotId, stretch, shown.frame.sourceSec, frameLayout, outputFrame) : null),
    [shown, services, shots, shotId, stretch, frameLayout, outputFrame],
  );
  const picking = state.phase === 'choosing' || (state.phase !== 'following' && state.phase !== 'looking' && shown !== null);
  // A look not said yet leaves the section as it was, its buttons held, so a quick answer replaces it outright.
  const busy = state.phase === 'looking' && !state.said;
  const inView = state.phase === 'looking' && !state.said ? state.before : state;

  return (
    <Section title="Follow">
      <div className="flex flex-col gap-2">
        {shown !== null && (
          <PeopleFrame
            shown={shown}
            camera={camera}
            waitsForPick={state.phase === 'choosing'}
            sampler={sampler}
            source={video.preview?.file ?? video.file}
            onChoose={picking ? (index) => void flow.choose(shown.frame, index) : null}
          />
        )}
        <div className={STATUS_BOX}>
          <FlowStatus state={inView} shown={shown} following={following} />
        </div>
        {following && inView.phase !== 'choosing' && inView.phase !== 'following' && (
          <div className={FIELD_ROW_CLASS}>
            <Slider
              label="Zoom"
              value={Math.round(closeness * 100)}
              min={ZOOM_PERCENT.min}
              max={ZOOM_PERCENT.max}
              step={ZOOM_PERCENT.step}
              unit="%"
              onChange={(percent) => onCloseness(percent / 100)}
            />
          </div>
        )}
        <FlowButtons state={inView} busy={busy} following={following} onLook={onLook} />
      </div>
    </Section>
  );
});

interface FlowStatusProps {
  state: ShotFollowFlowState;
  shown: ShownFollowFrame | null;
  following: boolean;
}

/** One line saying where the flow is, or what the shot does now. */
function FlowStatus({ state, shown, following }: FlowStatusProps) {
  if (state.phase === 'looking') {
    return <div className={STATUS}><Loader2 size={12} className="animate-spin" aria-hidden />Looking for people in this shot…</div>;
  }
  if (state.phase === 'following') {
    const percent = Math.round(state.fraction * 100);
    return (
      <>
        <div className={STATUS}><Loader2 size={12} className="animate-spin" aria-hidden />Following person {state.chosen + 1} through the shot…<span className={PERCENT}>{percent}%</span></div>
        <div className={TRACK} role="progressbar" aria-label="Following the person" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={FILL} style={{ width: `${percent}%` }} />
        </div>
      </>
    );
  }
  if (state.phase === 'choosing') return <p className={HINT}>{state.frame.people.length} people were found. Click the person to follow.</p>;
  if (state.phase === 'nobody') {
    return <p className={HINT}>{following ? 'No person was found. The camera follows as it did.' : 'No person was found in this shot.'}</p>;
  }
  if (state.phase === 'failed') return <p className={HINT}>The video could not be read to find people. Try again.</p>;
  if (!following) return null;
  if (shown === null || !shown.camera) return <p className={HINT}>The camera follows a person and keeps them in the frame.</p>;
  if (shown.frame.people.length > 1) {
    return <p className={HINT}>The box is what the camera shows on this frame. Click another person to follow them instead.</p>;
  }
  return <p className={HINT}>The box is what the camera shows on this frame. Move the playhead to see another.</p>;
}

interface FlowButtonsProps {
  state: ShotFollowFlowState;
  /** A look is under way that is not said yet: the buttons stay where they are, held. */
  busy: boolean;
  following: boolean;
  onLook: () => void;
}

/**
 * Looking again, once the shot follows someone or nobody was found, held
 * in place while that look runs, which takes about a second. Nothing
 * while a person is picked or followed, or the first look runs: picking
 * another camera, or none, stops those, as it leaves any camera.
 */
function FlowButtons({ state, busy, following, onLook }: FlowButtonsProps) {
  if (state.phase === 'following' || state.phase === 'choosing') return null;
  const looksAgain = following || state.phase === 'nobody' || state.phase === 'failed'
    || (state.phase === 'looking' && state.before.phase !== 'idle');
  if (!looksAgain) return null;
  const looking = busy || state.phase === 'looking';
  return (
    <button type="button" className={`${BTN_SECONDARY_SM} self-start`} onClick={onLook} disabled={looking} aria-busy={looking}>
      {/* The spinner waits for the look to be said, as the status does, so a quick answer changes nothing seen. */}
      {state.phase === 'looking' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ScanFace size={14} aria-hidden />} Look for people again
    </button>
  );
}

interface PeopleFrameProps {
  shown: ShownFollowFrame;
  /** What the camera shows of the frame, as shares of it; null where it is not drawn. */
  camera: NormalizedBbox | null;
  /** A person is to be picked on the frame now. */
  waitsForPick: boolean;
  sampler: VideoFrameSampler;
  source: Blob | null;
  /** Called with the index of the person clicked; null where no one can be picked now. */
  onChoose: ((index: number) => void) | null;
}

/**
 * A frame of the shot, whole, with a numbered box over each person seen
 * in it, from left to right, dashed; what the camera shows lit with the
 * rest of the frame dimmed, in place of the person followed where it is
 * drawn, else the person followed lit. Brought into view while a person
 * is to be picked on it, since it opens at the foot of the panel.
 */
function PeopleFrame({ shown, camera, waitsForPick, sampler, source, onChoose }: PeopleFrameProps) {
  const { picture, reading } = useShotFrame(sampler, source, shown.frame.sourceSec);
  const { video } = useEditorState();
  const aspect = video.layout !== null && video.layout.height > 0 ? video.layout.width / video.layout.height : 16 / 9;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (waitsForPick) container.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [waitsForPick, shown.frame]);
  return (
    <div ref={container} className="relative w-full overflow-hidden rounded-sm bg-surface-2" style={{ aspectRatio: aspect }}>
      {picture !== null && <img src={picture} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {reading && <FrameReadingMark />}
      {camera !== null && (
        <div role="img" aria-label="What the camera shows" className={`${BOX} ${FOLLOWED_BOX} pointer-events-none`} style={boxStyle(camera)}>
          <span className={`${TAG} ${FOLLOWED_TAG}`}>{shown.chosen !== null && shown.frame.people.length > 1 ? `${shown.chosen + 1} · Following` : 'Following'}</span>
        </div>
      )}
      {shown.frame.people.map((person, index) => {
        const followed = index === shown.chosen;
        if (followed && shown.camera) return null;
        return (
          <button
            key={index}
            type="button"
            disabled={onChoose === null || followed}
            aria-pressed={followed}
            aria-label={followed ? `Following person ${index + 1}` : `Follow person ${index + 1}`}
            className={`${BOX} ${followed ? FOLLOWED_BOX : OFFERED_BOX} ${onChoose === null && !followed ? 'opacity-60' : ''}`}
            style={boxStyle(person.box)}
            onClick={() => onChoose?.(index)}
          >
            <span className={`${TAG} ${followed ? FOLLOWED_TAG : OFFERED_TAG}`}>{followed ? `${index + 1} · Following` : index + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Where a box over the frame goes, its sides as shares of the frame. */
function boxStyle(box: NormalizedBbox): CSSProperties {
  return {
    left: `${box.minX * 100}%`,
    top: `${box.minY * 100}%`,
    width: `${(box.maxX - box.minX) * 100}%`,
    height: `${(box.maxY - box.minY) * 100}%`,
  };
}
