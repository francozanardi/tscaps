import { memo, useCallback, useMemo } from 'react';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { CameraPanel, type CameraFollowOption, type CameraPicture } from '@ui/pages/editor/features/shots/camera/CameraPanel';
import { ShotFollowSection } from '@ui/pages/editor/features/shots/camera/ShotFollowSection';
import { useShotFollowFlow } from '@ui/pages/editor/features/shots/hooks/useShotFollowFlow';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { useShotMoment } from '@ui/pages/editor/features/shots/hooks/useShotMoment';
import { useShotFrame } from '@ui/pages/editor/features/shots/hooks/useShotFrame';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';

interface ShotCameraPanelProps {
  shotId: string;
  /**
   * Where the shot starts and where its own video stops being drawn, in
   * source time: its end, or that of the last shot its video runs
   * through. The end is null where the video's length is not known yet.
   */
  startSec: number;
  endSec: number | null;
}

const CENTRED = { x: 0.5, y: 0.5 };
// The shot's start and end are looked at this far inside them, past whatever a cut leaves on an edge frame.
const EDGE_SEC = 0.1;
const CANNOT_FOLLOW = 'To follow a person, the frame must crop the video. Pick a frame shape in Ratio.';

/**
 * What a shot's camera does with the shot's own video, which the frame
 * cuts: the camera picked on a frame of the shot — the whole video where
 * a filled output frame crops it, which a shot's camera can look at all
 * of along that axis; the frame as composed otherwise. The frame shown
 * is the one at the playhead, or the shot's edge nearest to it where the
 * playhead is outside the shot. A shot's camera can also follow a
 * person, picked on a frame of the shot: offered as one more camera,
 * where the frame crops the video or the camera holds it closer. Nothing
 * is looked for until it is picked; then the frame shown is looked at
 * first, else the shot's start or end.
 */
export const ShotCameraPanel = memo(function ShotCameraPanel({ shotId, startSec, endSec }: ShotCameraPanelProps) {
  const { outputFrame, frameLayout, video, shots } = useEditorState();
  const { actions } = useShots();
  const form = useShotLayerMotionForm();
  const { flow, state } = useShotFollowFlow(shotId);
  const timeMap = useRenderTimeMap();
  const sampler = useVideoFrameSampler();
  const shotEndSec = endSec ?? video.duration;
  const moment = useShotMoment(startSec, shotEndSec);
  const poster = useShotFrame(sampler, video.preview?.file ?? video.file, moment);
  const soundsPresenter = useAnchoredSoundsPresenter();
  const soundAnchor = useMemo(() => soundsPresenter.cameraAnchor(shotId), [soundsPresenter, shotId]);
  const target = useMemo(() => ({ kind: 'shot' as const, shotId }), [shotId]);
  // Where the frame crops the video: a framing is placed from there until it is aimed.
  const frameShare = useMemo(
    () => (outputFrame.fit === 'fill' && !outputFrame.isOriginal() ? outputFrame.position : CENTRED),
    [outputFrame],
  );
  const frameAspect = frameLayout !== null && frameLayout.height > 0 ? frameLayout.width / frameLayout.height : 16 / 9;
  const croppedAxis = outputFrame.croppedAxis(video.layout);
  const videoAspect = video.layout !== null && video.layout.height > 0 ? video.layout.width / video.layout.height : frameAspect;
  const picture = useMemo<CameraPicture>(() => {
    if (croppedAxis === null) {
      const fitted = outputFrame.fit === 'fit' && !outputFrame.isOriginal();
      const posterFit = !fitted ? 'cover' as const : outputFrame.backdrop === 'blur' ? 'contain-blur' as const : 'contain-black' as const;
      return { aspect: frameAspect, span: { x: 1, y: 1 }, posterFit };
    }
    const across = croppedAxis === 'x' ? videoAspect / frameAspect : frameAspect / videoAspect;
    return { aspect: videoAspect, span: croppedAxis === 'x' ? { x: across, y: 1 } : { x: 1, y: across }, posterFit: 'cover' };
  }, [croppedAxis, frameAspect, videoAspect, outputFrame]);
  const style = shots.layerStyles.get(ShotVideoLayerId.of(shotId));
  const closeness = form.cameraOf(style?.fields, style?.animations?.[ElementAnimationScope.CAMERA]).start.scale;
  const followed = shots.list().find((shot) => shot.id === shotId)?.follow !== undefined;
  const stretch = useMemo(() => ({ startSec, endSec: shotEndSec }), [startSec, shotEndSec]);
  const lookForPeople = useCallback(
    () => void flow.start([...new Set([moment, startSec + EDGE_SEC, shotEndSec - EDGE_SEC])].filter((sec) => sec >= startSec && sec < shotEndSec)),
    [flow, moment, startSec, shotEndSec],
  );
  const follow = useMemo<CameraFollowOption>(() => ({
    selected: followed || state.phase !== 'idle',
    unavailableReason: croppedAxis !== null || closeness > 1 ? null : CANNOT_FOLLOW,
    onSelect: lookForPeople,
    onLeave: () => flow.cancel(),
    section: (
      <ShotFollowSection
        shotId={shotId}
        flow={flow}
        state={state}
        sampler={sampler}
        stretch={stretch}
        momentSec={moment}
        onLook={lookForPeople}
        closeness={closeness}
        onCloseness={(scale) => actions.setCamera.holdCloseness(target, scale)}
      />
    ),
  }), [followed, state, croppedAxis, closeness, lookForPeople, flow, shotId, sampler, stretch, moment, actions, target]);
  return (
    <CameraPanel
      target={target}
      styleId={ShotVideoLayerId.of(shotId)}
      soundAnchor={soundAnchor}
      outputStartSec={timeMap.toOutputTime(startSec)}
      outputEndSec={timeMap.toOutputTime(endSec ?? video.duration)}
      poster={poster.picture}
      posterReading={poster.reading}
      picture={picture}
      frameShare={frameShare}
      follow={follow}
    />
  );
});
