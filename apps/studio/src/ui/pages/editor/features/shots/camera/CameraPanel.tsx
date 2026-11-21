import { memo, useCallback, useMemo, type ReactNode } from 'react';
import { Ban, ScanFace } from 'lucide-react';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ShotCameraEnd } from '@core/shots/actions/SetShotCameraAction';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { ShotCameraTarget } from '@core/shots/domain/ShotCameraTarget';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { AnimationCardGrid } from '@ui/_shared/components/element-fields/AnimationCardGrid';
import { ElementAnimationCard } from '@ui/_shared/components/element-fields/ElementAnimationCard';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useRangeReplay } from '@ui/pages/editor/features/element/useRangeReplay';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { ShotCameraFramePicker } from '@ui/pages/editor/features/shots/camera/ShotCameraFramePicker';
import { Plus } from 'lucide-react';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { useShotLayerTakeover } from '@ui/pages/editor/features/shots/hooks/useShotLayerTakeover';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { AnchoredSoundList } from '@ui/pages/editor/features/audio/components/AnchoredSoundList';
import { SoundPickerPopover } from '@ui/pages/editor/features/audio/components/SoundPickerPopover';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { ShotLayerMotionFieldControl } from '@ui/pages/editor/features/shots/components/ShotLayerMotionFieldControl';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

/** The picture the position is picked on: its shape, how much of it the box spans on each axis, and how it is drawn. */
export interface CameraPicture {
  readonly aspect: number;
  readonly span: { readonly x: number; readonly y: number };
  readonly posterFit: 'cover' | 'contain-blur' | 'contain-black';
}

interface CameraPanelProps {
  target: ShotCameraTarget;
  /** The style the camera is written into: the shot's video's, or the layer's. */
  styleId: string;
  /** Where the camera's sounds are anchored. */
  soundAnchor: AudioAnchor;
  /** Where what the camera films starts and ends on the output. */
  outputStartSec: number;
  outputEndSec: number;
  /** A frame of what it films, as a URL; null while it is being taken. */
  poster: string | null;
  /** A newer frame is being read for the poster. */
  posterReading?: boolean;
  picture: CameraPicture;
  /** Where a framing is placed until it is aimed: where the picture is cropped, or its middle. */
  frameShare: { readonly x: number; readonly y: number };
  /** A camera that follows a person, offered beside the presets where the target can follow one (a shot). */
  follow?: CameraFollowOption | undefined;
}

/**
 * Following a person, offered as one more camera: picked instead of a
 * preset, and showing, while picked, what it is about in place of the
 * position, move and sounds a preset has.
 */
export interface CameraFollowOption {
  /** Whether the camera follows a person, or one is being picked. */
  readonly selected: boolean;
  /** Why no person can be followed here, said on the card; null where one can. */
  readonly unavailableReason: string | null;
  readonly onSelect: () => void;
  /** Another camera, or none, was picked instead. */
  readonly onLeave: () => void;
  /** Shown under the cameras while following is picked. */
  readonly section: ReactNode;
}

const CAMERA = ElementAnimationScope.CAMERA;
const GLYPH_SIZE = 22;
// A move is replayed a little past its end, so it is seen to settle.
const SETTLE_SEC = 0.8;
// A frame inside the shot rather than on its edge, where the shot before may still be drawn.
const INSIDE_SEC = 0.02;
// Where a whole-shot effect (a bounce) is at its closest, as a share of the shot.
const EFFECT_PEAK_SHARE = 0.4;

// Fields the boxes on the frame already set, so they are not offered twice as sliders.
const BOX_FIELD_IDS: ReadonlySet<string> = new Set(['zoom', 'start-x', 'end-x', 'anchor-x', 'anchor-y']);

/**
 * What a camera does with what it films — a shot's own video, cut by
 * the frame, or a layer's picture, cut by the layer's box: a preset in
 * one click, then where it starts and ends on a frame of the picture,
 * how long its move lasts, how hard its effect is, and the sounds on the
 * camera, its preset's among them, listed as every sound on an anchor
 * is.
 *
 * Picking a preset — the one held included, which changes nothing —
 * plays it from its start in the preview, with its sound, as far as the
 * move goes and a moment more. Taking hold of a box instead pauses on
 * the frame it shows, so a drag is watched there without the move
 * playing again.
 */
export const CameraPanel = memo(function CameraPanel({
  target,
  styleId,
  soundAnchor,
  outputStartSec,
  outputEndSec,
  poster,
  posterReading = false,
  picture,
  frameShare,
  follow,
}: CameraPanelProps) {
  const { actions } = useShots();
  const { shots, projectId } = useEditorState();
  const timeMap = useRenderTimeMap();
  const replayRange = useRangeReplay();
  const style = shots.layerStyles.get(styleId);
  const form = useShotLayerMotionForm();
  const animation = style?.animations?.[CAMERA];
  const camera = useMemo(() => form.cameraOf(style?.fields, animation), [form, style?.fields, animation]);
  const takeover = useShotLayerTakeover(style);
  const moveTaken = takeover.motion.has(CAMERA);
  const fields = useMemo(
    () => form.fieldsOf(animation).filter((view) => !BOX_FIELD_IDS.has(view.control.id)),
    [form, animation],
  );
  const spanSec = Math.max(0, outputEndSec - outputStartSec);
  // A momentary camera that closes in on a point, over the whole frame, is placed by that point.
  const anchor = camera.anchor !== null && camera.start.scale === 1 && camera.end.scale === 1 ? camera.anchor : null;
  const following = follow?.selected === true;
  // A shot with no camera still has a place to look along the axis the output frame crops it; only a camera goes closer.
  const placedWithoutCamera = camera.presetId === null && target.kind === 'shot' && (picture.span.x > 1 || picture.span.y > 1);
  const placeable = placedWithoutCamera
    || (camera.presetId !== null && (camera.start.scale > 1 || camera.end.scale > 1 || anchor !== null));
  const audioMix = useAudioMix();
  const soundsPresenter = useAnchoredSoundsPresenter();

  // Read when called, so the move just changed is the one played, and from early enough to take in the sounds
  // placed before the shot starts, as a snap's are.
  const store = useEditor().store;
  const playShot = useCallback((durationSec: number | null) => {
    const outputEnd = durationSec === null ? outputEndSec : Math.min(outputEndSec, outputStartSec + durationSec + SETTLE_SEC);
    const leadSec = Math.max(0, ...soundsPresenter.effectsOn(store.snapshot().audio, soundAnchor).map(({ start }) => -start.offsetSec));
    replayRange(timeMap.toSourceTime(Math.max(0, outputStartSec - leadSec)), timeMap.toSourceTime(outputEnd), true);
  }, [timeMap, outputStartSec, outputEndSec, replayRange, store, soundsPresenter, soundAnchor]);
  // Puts on screen, paused, the frame a box shows: the shot's first for the start, the move's last for the end.
  const playback = usePlayback();
  const show = useCallback((what: ShotCameraEnd | 'anchor') => {
    const offsetSec = what === 'start' ? INSIDE_SEC
      : what === 'anchor' ? spanSec * EFFECT_PEAK_SHARE
        : (camera.durationSec ?? spanSec);
    playback.pause();
    playback.seek(timeMap.toSourceTime(Math.min(outputEndSec - INSIDE_SEC, outputStartSec + offsetSec)));
  }, [timeMap, outputStartSec, outputEndSec, spanSec, camera, playback]);

  // A move's length goes through the camera, which keeps its sound on it; the rest is the preset's own.
  const setField = useCallback((controlId: string, value: ElementControlValue) => {
    if (controlId === 'duration' && typeof value === 'number') actions.setCamera.setDuration(target, value);
    else actions.setLayerAnimation.setParam([styleId], CAMERA, controlId, value);
  }, [actions, target, styleId]);

  // Picking the preset the shot has changes nothing and plays it again, as the user left it.
  const pick = useCallback((presetId: string | null) => {
    if (following) follow?.onLeave();
    const kept = !following && presetId !== null && presetId === camera.presetId;
    actions.setCamera.pick(target, presetId);
    const preset = form.presets(CAMERA).find((candidate) => candidate.id === presetId) ?? null;
    const ownDuration = preset?.controls.find((control) => control.id === 'duration')?.defaultValue;
    if (preset !== null) playShot(kept ? camera.durationSec : typeof ownDuration === 'number' ? ownDuration : null);
  }, [actions, target, form, playShot, camera, following, follow]);

  return (
    <div className="flex flex-col">
      <Section title="Camera">
        <CustomizedFieldOverlay customized={moveTaken} label="Camera">
        <AnimationCardGrid label="Camera">
          <ElementAnimationCard
            label="None"
            selected={!following && camera.presetId === null}
            icon={<Ban size={GLYPH_SIZE} strokeWidth={1.5} />}
            onSelect={() => pick(null)}
          />
          {follow !== undefined && (
            <ElementAnimationCard
              label="Follow"
              selected={following}
              selectedTitle="Follows a person"
              disabledReason={follow.unavailableReason}
              icon={<ScanFace size={GLYPH_SIZE} strokeWidth={1.5} />}
              onSelect={() => { if (!following) follow.onSelect(); }}
            />
          )}
          {/* Drawn by the preset's own picture, as a layer motion's card is. */}
          {form.presets(CAMERA).map((preset) => (
            <ElementAnimationCard
              key={preset.id}
              label={form.labelOf(preset)}
              selected={!following && camera.presetId === preset.id}
              icon={<span dangerouslySetInnerHTML={{ __html: preset.icon }} />}
              onSelect={() => pick(preset.id)}
            />
          ))}
        </AnimationCardGrid>
        </CustomizedFieldOverlay>
      </Section>

      {following && follow?.section}

      {!following && placeable && (
        <Section title="Position">
          <CustomizedFieldOverlay customized={takeover.cameraPosition} label="Camera position">
          <div className="flex flex-col gap-2">
            <ShotCameraFramePicker
              poster={poster}
              posterReading={posterReading}
              pictureAspect={picture.aspect}
              span={picture.span}
              posterFit={picture.posterFit}
              frameShare={frameShare}
              start={camera.start}
              end={camera.moves() ? camera.end : null}
              anchor={anchor}
              zoomable={!placedWithoutCamera}
              onFraming={(end, framing) => actions.setCamera.setFraming(target, end, framing)}
              onAnchor={(point) => actions.setCamera.setEffectAnchor(target, point)}
              onShow={show}
            />
            <p className="m-0 text-2xs text-fg-faint leading-snug">
              {anchor !== null
                ? 'Drag the dot to where it zooms.'
                : placedWithoutCamera ? 'Drag to move. Pick a camera to zoom.'
                  : camera.moves() ? 'Pick Start or End on its tag. Drag to move, corner to zoom.' : 'Drag to move, corner to zoom.'}
            </p>
          </div>
          </CustomizedFieldOverlay>
        </Section>
      )}

      {!following && fields.length > 0 && (
        <Section title="Move">
          <CustomizedFieldOverlay customized={moveTaken} label="Camera move">
            <div className={FIELD_ROWS_CLASS}>
              {fields.map((view) => (
                <div key={view.control.id} className={FIELD_ROW_CLASS}>
                  <ShotLayerMotionFieldControl form={form} view={view} mixed={false} onChange={setField} />
                </div>
              ))}
            </div>
          </CustomizedFieldOverlay>
        </Section>
      )}

      {!following && camera.presetId !== null && (
        <Section title="Sound">
          <div className="flex flex-col gap-2">
            <AnchoredSoundList anchor={soundAnchor} nudges={false} />
            <SoundPickerPopover
              mode="effect"
              projectId={projectId}
              pickLabel="Add"
              onPick={(source) => audioMix.actions.addClips.execute([soundsPresenter.effectDraft(soundAnchor, source)])}
              trigger={<button type="button" className={`${BTN_SECONDARY_SM} self-start`}><Plus size={14} /> Add sound</button>}
            />
          </div>
        </Section>
      )}
    </div>
  );
});
