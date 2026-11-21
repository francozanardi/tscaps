import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ElementControlCssWriter, ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { ShotCamera, ShotCameraVariable } from '@core/shots/domain/ShotCamera';
import type { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { HELD_CAMERA_PRESET_ID } from '@core/shots/domain/HeldCameraPreset';
import type { ShotCameraTarget } from '@core/shots/domain/ShotCameraTarget';
import type { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/** Which end of a shot's camera move a framing is: where it starts, or where it moves to. */
export type ShotCameraEnd = 'start' | 'end';

/** A point of the output frame, each axis a share of the frame's (0 to 1). */
export interface ShotCameraPoint {
  readonly x: number;
  readonly y: number;
}

/** The axis the output frame crops the video on, where the share of a framing held at the frame's size still matters. */
type CroppedAxis = 'x' | 'y' | null;

const CAMERA = ElementAnimationScope.CAMERA;

type Positions = typeof ShotVideoFraming.POSITION_FIELD_IDS;

/**
 * Sets what a shot's camera does with the shot's own video. The camera
 * is a preset of the animation library's `camera` scope, written into
 * the shot video's CSS as any layer's motion is: how close it starts
 * and ends, how long it takes, how hard a momentary one shakes, are the
 * preset's values, changed by hand over its own. Where it looks is the
 * shot's own, in its position fields, or the output frame's crop where
 * it names none. A preset's sound is an ordinary effect on the shot's
 * camera (`ShotCameraSounds`), apart from the sounds on the shot's start;
 * picking another preset swaps it for the new one's and keeps any other
 * sound on the camera, and taking the camera away takes every sound on
 * it.
 *
 * Picking another preset gives it its own values and takes the shot's
 * position back to the frame's crop; picking the one the shot has
 * changes nothing, so what was changed by hand stays while it is played
 * again. **A camera and a follow are one or the other**: picking a
 * camera, or none, takes away the person a shot follows. A camera the shot video's own CSS has taken over is left as it
 * is, its sound included.
 *
 * **A zoom goes straight into its framing.** Where one framing holds the
 * whole frame and the other is closer, the whole one takes the closer
 * one's position on every axis the output frame does not crop: there it
 * changes nothing it shows, and with both alike the view closes in on
 * one point instead of drifting towards it.
 *
 * A shot still only proposed is made real first, as any edit to a shot
 * makes it. Each call is one undo step, the sound with the rest, and a
 * run of changes to the same part of the same shot — a drag —
 * coalesces into one. A shot the partition does not hold, or a change
 * that changes nothing, does nothing.
 */
export class SetShotCameraAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly catalog: StyledElementCatalog,
    private readonly controls: ElementControlCssWriter,
    private readonly presets: ElementAnimationCatalog,
    private readonly animations: ElementAnimationCssWriter,
    private readonly sounds: ShotCameraSounds,
    private readonly clipDefaults: AudioClipDefaults,
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly boxShape: ShotLayerBoxShape,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** Gives `target` the camera preset `presetId`, or takes its camera away for `null`. */
  pick(target: ShotCameraTarget, presetId: string | null): void {
    const preset = presetId === null ? null : this.presets.byId(presetId);
    if (presetId !== null && preset === null) return;
    const previous = this.store.snapshot().shots.layerStyles.animationOf(this.layerIdOf(target), CAMERA)?.presetId ?? null;
    const changed = this.write(target, `preset=${presetId ?? 'none'}`, true, (styles, layerId, audio) => {
      const held = styles.get(layerId)?.animations?.[CAMERA]?.presetId ?? null;
      if ((held !== null && held === presetId) || this.isTakenOver(styles, layerId)) return { styles, audio };
      const unplaced = this.withoutPositions(styles, layerId, ['x', 'y']);
      const written = this.withCamera(unplaced, layerId, presetId === null ? undefined : { presetId, params: {} });
      if (preset === null || presetId === null) {
        return { styles: written, audio: this.withoutCameraSounds(audio, target) };
      }
      const heldClip = held === null ? null : this.sounds.clipIn(audio, target, held);
      const withoutSound = heldClip === null ? audio : audio.withoutClips([heldClip.id]);
      const draft = this.sounds.draftFor(target, presetId, this.defaultOf(preset, ShotCameraVariable.DURATION));
      return {
        styles: written,
        audio: draft === null ? withoutSound : withoutSound.withClipAdded(this.clipDefaults.clipFrom(crypto.randomUUID(), draft)),
      };
    });
    if (changed && previous !== presetId) this.telemetry.cameraSet(target.kind, presetId, previous);
  }

  /**
   * Holds `target` at `scale` for its whole length, with no move: the
   * held preset (a punch-in) closer than the frame, no camera at the
   * frame's own closeness. A move it had is replaced, the sounds on its
   * camera with it; where it looks is kept. How close a camera that
   * follows a person keeps them, whose follow says where it looks; the
   * follow stays.
   */
  holdCloseness(target: ShotCameraTarget, scale: number): void {
    const held = this.presets.byId(HELD_CAMERA_PRESET_ID);
    const scaleControl = held === null ? null : this.controlOf(held, ShotCameraVariable.START_SCALE);
    this.write(target, 'closeness', false, (styles, layerId, audio) => {
      if (this.isTakenOver(styles, layerId)) return { styles, audio };
      const current = styles.get(layerId)?.animations?.[CAMERA];
      if (held === null || scaleControl === null || scale <= 1) {
        if (current === undefined) return { styles, audio };
        return { styles: this.withCamera(styles, layerId, undefined), audio: this.withoutCameraSounds(audio, target) };
      }
      const closeness = { [scaleControl]: this.rounded(scale) };
      if (current?.presetId === held.id) return { styles: this.withParams(styles, layerId, current, held, closeness), audio };
      const fresh = { presetId: held.id, params: {} };
      return {
        styles: this.withParams(this.withCamera(styles, layerId, fresh), layerId, fresh, held, closeness),
        audio: current === undefined ? audio : this.withoutCameraSounds(audio, target),
      };
    });
  }

  /** Holds `target` as close as its camera comes at either end, with no move: what a camera keeps once it follows a person. */
  holdClosest(target: ShotCameraTarget): void {
    const shots = this.materializer.materializeFrom(this.store.snapshot());
    const camera = this.cameraOf(shots.layerStyles, this.layerIdOf(target));
    this.holdCloseness(target, Math.max(camera.start.scale, camera.end.scale));
  }

  /**
   * Holds the shot's picture at `framing` at `end` of its move: how close
   * is the preset's (both ends at once for one that holds), where it
   * looks is the shot's — or a pan's travel, along the axis it pans. A
   * framing that holds the whole frame is lined up with it, so a zoom
   * goes straight. A shot with no camera preset has none to set.
   */
  setFraming(target: ShotCameraTarget, end: ShotCameraEnd, framing: ShotVideoFraming): void {
    this.write(target, `framing.${end}`, false, (styles, layerId, audio, cropped) => {
      const animation = styles.get(layerId)?.animations?.[CAMERA];
      const preset = animation?.presetId ? this.presets.byId(animation.presetId) : null;
      if (animation === undefined || preset === null) {
        return { styles: this.withPositionWithoutCamera(styles, layerId, target, end, framing, cropped), audio };
      }
      const scaleProperty = end === 'start' ? ShotCameraVariable.START_SCALE : ShotCameraVariable.END_SCALE;
      const panProperty = end === 'start' ? ShotCameraVariable.START_X : ShotCameraVariable.END_X;
      const params: Record<string, ElementControlValue> = {};
      const scaleControl = this.controlOf(preset, scaleProperty) ?? this.controlOf(preset, end === 'start' ? ShotCameraVariable.END_SCALE : ShotCameraVariable.START_SCALE);
      if (scaleControl !== null) params[scaleControl] = this.rounded(framing.scale);
      const panControl = this.controlOf(preset, panProperty);
      if (panControl !== null && framing.x !== null) params[panControl] = this.rounded(framing.x);
      let written = this.withParams(styles, layerId, animation, preset, params);
      const ids = end === 'start' ? ShotVideoFraming.POSITION_FIELD_IDS : ShotVideoFraming.END_POSITION_FIELD_IDS;
      written = this.withPosition(written, layerId, ids, panControl === null ? framing.x : null, framing.y);
      const camera = this.cameraOf(written, layerId);
      const placed = end === 'start' ? camera.start : camera.end;
      const other = end === 'start' ? camera.end : camera.start;
      if (other.scale !== 1 || placed.scale === 1) return { styles: written, audio };
      // The whole-frame end follows the closer one where the frame crops nothing.
      const otherIds = end === 'start' ? ShotVideoFraming.END_POSITION_FIELD_IDS : ShotVideoFraming.POSITION_FIELD_IDS;
      written = this.withPosition(
        written,
        layerId,
        otherIds,
        cropped === 'x' || camera.pans ? null : placed.x,
        cropped === 'y' ? null : placed.y,
      );
      return { styles: written, audio };
    });
  }

  /** Makes the move last `durationSec` from the shot's start, for a preset whose move has a length of its own; its sound moves with it. */
  setDuration(target: ShotCameraTarget, durationSec: number): void {
    this.write(target, 'duration', false, (styles, layerId, audio) => {
      const animation = styles.get(layerId)?.animations?.[CAMERA];
      const preset = animation?.presetId ? this.presets.byId(animation.presetId) : null;
      const control = preset === null ? null : this.controlOf(preset, ShotCameraVariable.DURATION);
      if (animation === undefined || preset === null || control === null || animation.presetId === null) return { styles, audio };
      const seconds = this.rounded(durationSec);
      const written = this.withParams(styles, layerId, animation, preset, { [control]: seconds });
      const clip = this.sounds.clipIn(audio, target, animation.presetId);
      if (clip === null) return { styles: written, audio };
      return { styles: written, audio: audio.withClipsPatched([clip.id], { startOffsetSec: this.sounds.offsetFor(animation.presetId, seconds) }) };
    });
  }

  /** Makes a momentary camera close in on `point`, a share of the frame, for one that closes in on a point. */
  setEffectAnchor(target: ShotCameraTarget, point: ShotCameraPoint): void {
    this.write(target, 'anchor', false, (styles, layerId, audio) => {
      const animation = styles.get(layerId)?.animations?.[CAMERA];
      const preset = animation?.presetId ? this.presets.byId(animation.presetId) : null;
      if (animation === undefined || preset === null) return { styles, audio };
      const x = this.controlOf(preset, ShotCameraVariable.ANCHOR_X);
      const y = this.controlOf(preset, ShotCameraVariable.ANCHOR_Y);
      if (x === null || y === null) return { styles, audio };
      return { styles: this.withParams(styles, layerId, animation, preset, { [x]: this.rounded(point.x), [y]: this.rounded(point.y) }), audio };
    });
  }

  /** Gives back to the output frame's crop where the shot looks on `axis`; a pan's travel stays its own. */
  followFrame(target: ShotCameraTarget, axis: 'x' | 'y'): void {
    this.write(target, `follow.${axis}`, false, (styles, layerId, audio) => ({ styles: this.withoutPositions(styles, layerId, [axis]), audio }));
  }

  /**
   * Sets where the picture is looked at, at `end` of the camera, as a
   * share on each axis (null takes that axis back to the output frame's
   * crop), whether or not the target has a camera preset: with none, the
   * view is held for its whole length at the frame's own closeness. How
   * close the camera is stays as it is.
   */
  place(target: ShotCameraTarget, end: ShotCameraEnd, x: number | null, y: number | null): void {
    this.write(target, `place.${end}`, false, (styles, layerId, audio) => {
      const ids = end === 'start' ? ShotVideoFraming.POSITION_FIELD_IDS : ShotVideoFraming.END_POSITION_FIELD_IDS;
      return { styles: this.withPosition(styles, layerId, ids, x, y), audio };
    });
  }

  /** Writes what `next` makes of the target's camera as one undo step; with `unfollow`, a shot's follow goes with it. */
  private write(
    target: ShotCameraTarget,
    change: string,
    unfollow: boolean,
    next: (styles: ElementStyles, layerId: string, audio: AudioMix, cropped: CroppedAxis) => { styles: ElementStyles; audio: AudioMix },
  ): boolean {
    const state = this.store.snapshot();
    const shots = this.materializer.materializeFrom(state);
    const layerId = this.layerIdOf(target);
    if (!shots.holdsStyleTarget(layerId)) return false;
    const written = next(shots.layerStyles, layerId, state.audio, this.croppedAxisOf(state, shots, target));
    const followed = unfollow && target.kind === 'shot' && shots.list().some((shot) => shot.id === target.shotId && shot.follow !== undefined);
    if (written.styles === shots.layerStyles && written.audio === state.audio && !followed) return false;
    this.store.commit('Change camera', `shotCamera:${layerId}:${change}`);
    const restyled = shots.withLayerStyles(written.styles);
    this.store.patch({ shots: followed && target.kind === 'shot' ? restyled.withFollow(target.shotId, null) : restyled, audio: written.audio });
    return true;
  }

  /** The id the camera of `target` is kept under: the shot's own video's, or the layer's. */
  private layerIdOf(target: ShotCameraTarget): string {
    return target.kind === 'shot' ? ShotVideoLayerId.of(target.shotId) : target.layerId;
  }

  /** The axis the picture is cropped on where it is held at its box's size: the output frame's for a shot, the layer's box's for a layer. */
  private croppedAxisOf(state: EditorState, shots: ShotPartition, target: ShotCameraTarget): CroppedAxis {
    if (target.kind === 'shot') return state.outputFrame.croppedAxis(state.video.layout);
    const layer = shots.findLayer(target.layerId);
    const frame = state.frameLayout;
    if (layer === null || frame === null || !(frame.height > 0)) return null;
    const asset = this.assets.assetOf(layer, this.media.snapshot());
    return this.boxShape.croppedAxisOf(shots.placementOf(target.layerId), frame.width / frame.height, asset?.aspectRatio ?? null);
  }

  private cameraOf(styles: ElementStyles, layerId: string): ShotCamera {
    const style = styles.get(layerId);
    const animation = style?.animations?.[CAMERA];
    return ShotCamera.of(style?.fields, animation, animation?.presetId ? this.presets.byId(animation.presetId) : null);
  }

  /** The id of `preset`'s field over `property`, or null where it offers none. */
  private controlOf(preset: ElementAnimationPreset, property: ShotCameraVariable): string | null {
    return preset.controls.find((control) => control.property === property)?.id ?? null;
  }

  private defaultOf(preset: ElementAnimationPreset, property: ShotCameraVariable): number | null {
    const value = preset.controls.find((control) => control.property === property)?.defaultValue;
    return typeof value === 'number' ? value : null;
  }

  /** `styles` with the camera's `params` set over its own, each kept within what its field allows. */
  private withParams(
    styles: ElementStyles,
    layerId: string,
    animation: ElementAnimation,
    preset: ElementAnimationPreset,
    params: Readonly<Record<string, ElementControlValue>>,
  ): ElementStyles {
    const next: Record<string, ElementControlValue> = { ...animation.params };
    for (const [id, value] of Object.entries(params)) {
      const control = preset.controls.find((candidate) => candidate.id === id);
      if (control === undefined) continue;
      next[id] = typeof value === 'number' ? Math.min(control.max ?? value, Math.max(control.min ?? value, value)) : value;
    }
    if (Object.entries(next).every(([id, value]) => animation.params[id] === value)) return styles;
    return this.withCamera(styles, layerId, { ...animation, params: next });
  }

  private withoutCameraSounds(audio: AudioMix, target: ShotCameraTarget): AudioMix {
    return audio.withoutClips(this.sounds.clipsOn(audio, target).map((clip) => clip.id));
  }

  /** Whether the shot video's own CSS has taken its camera over, so no pick writes it, nor its sound. */
  private isTakenOver(styles: ElementStyles, layerId: string): boolean {
    const style = styles.get(layerId);
    const current = style?.animations?.[CAMERA];
    return current !== undefined && this.animations.isTakenOver(style?.css ?? '', 'layer', CAMERA, current);
  }

  private withCamera(styles: ElementStyles, layerId: string, camera: ElementAnimation | undefined): ElementStyles {
    const style = styles.get(layerId);
    const current = style?.animations?.[CAMERA];
    if (current === camera) return styles;
    if (this.isTakenOver(styles, layerId)) return styles;
    return styles.withAnimation(layerId, 'layer', CAMERA, camera, this.animations.rewrite(style?.css ?? '', 'layer', CAMERA, current, camera));
  }

  /** `styles` with where the shot looks set by `ids` to `x` and `y`; a null one is taken back to the frame's crop. */
  /**
   * Where a shot with no camera looks, on the axis the output frame crops
   * it along: the only thing to place there, since only a camera goes
   * closer. A layer, and a shot the frame crops nothing of, are left as
   * they are.
   */
  private withPositionWithoutCamera(
    styles: ElementStyles,
    layerId: string,
    target: ShotCameraTarget,
    end: ShotCameraEnd,
    framing: ShotVideoFraming,
    cropped: CroppedAxis,
  ): ElementStyles {
    if (target.kind !== 'shot' || end !== 'start' || cropped === null) return styles;
    const ids = ShotVideoFraming.POSITION_FIELD_IDS;
    const along = cropped === 'x' ? framing.x : framing.y;
    return along === null ? styles : this.withField(styles, layerId, ids[cropped], this.rounded(along));
  }

  private withPosition(styles: ElementStyles, layerId: string, ids: Positions, x: number | null, y: number | null): ElementStyles {
    const written = x === null ? this.withoutField(styles, layerId, ids.x) : this.withField(styles, layerId, ids.x, this.rounded(x));
    return y === null ? this.withoutField(written, layerId, ids.y) : this.withField(written, layerId, ids.y, this.rounded(y));
  }

  private withoutPositions(styles: ElementStyles, layerId: string, axes: ReadonlyArray<'x' | 'y'>): ElementStyles {
    return [ShotVideoFraming.POSITION_FIELD_IDS, ShotVideoFraming.END_POSITION_FIELD_IDS].reduce(
      (current, ids) => axes.reduce((written, axis) => this.withoutField(written, layerId, ids[axis]), current),
      styles,
    );
  }

  private withField(styles: ElementStyles, layerId: string, fieldId: ElementFieldId, value: ElementControlValue): ElementStyles {
    if (styles.get(layerId)?.fields?.[fieldId] === value) return styles;
    const control = this.catalog.requireControl('layer', fieldId);
    const css = styles.get(layerId)?.css ?? '';
    return styles.withField(layerId, 'layer', fieldId, value, this.controls.write(css, control, value));
  }

  private withoutField(styles: ElementStyles, layerId: string, fieldId: ElementFieldId): ElementStyles {
    if (styles.get(layerId)?.fields?.[fieldId] === undefined) return styles;
    const control = this.catalog.requireControl('layer', fieldId);
    return styles.withoutField(layerId, 'layer', fieldId, this.controls.remove(styles.get(layerId)?.css ?? '', control));
  }

  private rounded(value: number): number {
    return Number(value.toFixed(4));
  }
}
