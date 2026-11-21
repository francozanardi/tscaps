import { z } from 'zod';
import type { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SetShotCameraAction, ShotCameraEnd } from '@core/shots/actions/SetShotCameraAction';
import type { SetShotVideoThroughAction } from '@core/shots/actions/SetShotVideoThroughAction';
import type { SetShotLayerAnimationAction } from '@core/shots/actions/SetShotLayerAnimationAction';
import { ShotCameraVariable } from '@core/shots/domain/ShotCamera';
import { HELD_CAMERA_PRESET_ID } from '@core/shots/domain/HeldCameraPreset';
import type { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import type { ShotAimPoint } from '@core/shots/services/ShotAimPoint';
import type { ShotLayerPanPace } from '@core/shots/services/ShotLayerPanPace';
import type { PictureArea, ShotPictureArea } from '@core/shots/services/ShotPictureArea';
import type { ShotCameraTarget } from '@core/shots/domain/ShotCameraTarget';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/** Whose camera a run changes: what the camera actions take, the style the camera is written in, and its ref. */
interface CameraSubject {
  readonly target: ShotCameraTarget;
  readonly styleId: string;
  readonly ref: string;
}

/** What a run asks of a camera besides how far it runs: whose it is, the move, its sound and its settings. */
interface CameraChange extends CameraSettings {
  readonly target: string;
  readonly preset?: string | null | undefined;
  readonly sound: boolean;
}

/** The settings a run asks of a move, each left out where it was not given. */
interface CameraSettings {
  readonly scale?: number | undefined;
  readonly x?: number | null | undefined;
  readonly y?: number | null | undefined;
  readonly fromX?: number | undefined;
  readonly toX?: number | undefined;
  readonly durationSec?: number | undefined;
  readonly intensity?: number | undefined;
}

/** A point of the source picture, each axis a share of it (0 its left or top edge); null on an axis left to the output frame's crop. */
interface PicturePoint {
  readonly x: number | null;
  readonly y: number | null;
}

const CAMERA = ElementAnimationScope.CAMERA;

const PRESET_TEXT = [
  'The camera move, by id. null takes the camera off, with every sound on it; leave it out to keep the move there is and change its settings.',
  'layer-punch-in-camera: cuts in close and holds for the whole shot.',
  'layer-slow-push-in-camera: closes in slowly over the whole shot.',
  'layer-zoom-in-camera: closes in over durationSec (1 s), then holds.',
  'layer-fast-zoom-in-camera: snaps in (0.35 s), then holds.',
  'layer-crash-zoom-camera: slams in very close in a blink (0.15 s), then holds.',
  'layer-slow-pull-out-camera: starts close and pulls back to the whole frame over the shot.',
  'layer-zoom-out-reveal-camera: starts very close and pulls back fast (0.6 s) to the whole frame.',
  'layer-pan-right-camera, layer-pan-left-camera: held close, travels across the picture over the shot.',
  'layer-bounce-camera: snaps in on a point as the shot starts and eases back out as it ends.',
  'layer-shake-camera: a handheld shake over the whole shot.',
].join(' ');

const AIM_TEXT = 'On a shot: the point of the whole source picture to put in the middle of the frame, 0 = its left or top edge, 0.5 = its middle, 1 = its right or bottom edge '
  + '(the face at 80% of the picture\'s width is x 0.8, at any scale); near an edge the frame stops at the edge. '
  + 'On a layer: as a share of what the box leaves out of its file. '
  + 'null hands it back to the output frame\'s crop, where a newly picked move starts. For a bounce, the point it bounces in on (null: the middle). Pans take y only.';

/**
 * `set_camera`: gives a shot's own video, or a b-roll or picture layer,
 * a camera move from the animation library's camera presets, changes
 * the one it has, or takes it off. The aim and the zoom are written on
 * the end of the move that is close (where a push-in ends, where a
 * pull-out starts, the whole shot for a move that holds), so a zoom
 * always goes straight into the point aimed at; a setting the move does
 * not have is refused rather than dropped.
 */
export class SetCameraOperation implements EditorOperation {
  /** What a move given no aim does on a framed shot: the part of the description an agent outside the app reads reworded. */
  static readonly FRAMED_AIM = 'On a shot that is framed (set_framing, or a reframe), a move given no x or y keeps aiming at the point the shot looks at, at both of its ends, so the subject stays where it was.';

  readonly name = 'set_camera';
  readonly effect = 'edit';
  readonly description = [
    'Give a shot\'s own video (target shot:<id>) or a b-roll or picture layer (layer:<id>) a camera move, change the settings of the one it has, or take it off (preset null).',
    'A move zooms in or out on the point x, y aims at, by `scale`; picking a move starts it from its own settings, and the settings given with it apply on top.',
    'Zoom in, fast zoom in, crash zoom, zoom-out reveal and bounce add their own whoosh on the camera (sound false leaves it out).',
    'A move with a length of its own takes durationSec; the others last the whole shot.',
    SetCameraOperation.FRAMED_AIM,
    'A shot\'s camera runs for its shot, and with `through` over every shot up to a later one: a move as one move, a punch-in as each shot\'s own, aimed where that shot looks. Splitting a shot leaves its camera on both halves: a move runs on over them until `through` is set to the shot itself, a punch-in or a framing is each half\'s own.',
  ].join(' ');

  private readonly input = new OperationInput({
    target: z.string().describe('Whose camera: shot:<id> for the shot\'s own video, or layer:<id> for a b-roll or a picture layer (a graphic has none).'),
    preset: z.string().nullable().optional().describe(PRESET_TEXT),
    scale: z.number().min(1).max(3).optional()
      .describe('How close the camera gets: 1 is the whole frame, 1.2 a gentle punch in, above 1.6 strong. A punch-in or a pan holds it, a push-in or zoom-in ends on it, a pull-out or reveal starts from it. Not for bounce or shake (use intensity). Default: the move\'s own.'),
    x: z.number().min(0).max(1).nullable().optional().describe(`Where the camera aims across. ${AIM_TEXT}`),
    y: z.number().min(0).max(1).nullable().optional().describe('Where the camera aims down, read as x is.'),
    fromX: z.number().min(0).max(1).optional().describe('Pans only: where the travel starts across the picture, 0 the left edge, 1 the right (a pan right starts at 0, a pan left at 1).'),
    toX: z.number().min(0).max(1).optional().describe('Pans only: where the travel ends across the picture, read as fromX is.'),
    durationSec: z.number().min(0.1).max(5).optional()
      .describe('How long the move takes from the shot\'s start, in seconds, then holds. Only zoom-in, fast-zoom-in, crash-zoom and zoom-out-reveal have one.'),
    intensity: z.number().min(0.1).max(1).optional().describe('How hard a bounce closes in or a shake shakes, 0.1 to 1. Bounce and shake only.'),
    sound: z.boolean().default(true).describe('false leaves out the move\'s own whoosh, or takes it off.'),
    through: z.string().optional().describe('Shots only: the last shot the camera runs over, as a ref: shot:<id>, the shot itself or a later one. A move stops before a shot with a camera or a framing of its own; a punch-in stops before a shot with a move of its own. Left out, it runs as far as it did.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly presets: ElementAnimationCatalog,
    private readonly animations: ElementAnimationCssWriter,
    private readonly cameraSounds: ShotCameraSounds,
    private readonly setCamera: SetShotCameraAction,
    private readonly setLayerAnimation: SetShotLayerAnimationAction,
    private readonly removeClips: RemoveAudioClipsAction,
    private readonly area: ShotPictureArea,
    private readonly aimPoint: ShotAimPoint,
    private readonly setVideoThrough: SetShotVideoThroughAction,
    private readonly panPace: ShotLayerPanPace,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { through, ...change } = checked.value;
    const subject = this.subjectOf(change.target);
    if (!subject.ok) return this.refused([subject.problem]);
    const throughProblem = through === undefined ? null : this.throughProblem(subject.value, through);
    if (throughProblem !== null) return this.refused([throughProblem]);
    const result = await this.changed(subject.value, change);
    if (!result.ok || through === undefined || subject.value.target.kind !== 'shot') return result;
    if (this.holdsOneFraming(subject.value.styleId)) return this.heldThrough(result, subject.value, change, through);
    return this.ranThrough(result, subject.value.target.shotId, through);
  }

  /** Whether the camera under `styleId` is the one that holds a framing for its whole shot: a punch-in. */
  private holdsOneFraming(styleId: string): boolean {
    return this.cameraOf(styleId)?.presetId === HELD_CAMERA_PRESET_ID;
  }

  /**
   * `result` after the punch-in `change` gave the shot of `subject` was
   * given to every shot after it through the one `through` names, each
   * as its own and aimed where that shot looks: the same zoom over them
   * all, with nothing lent from one shot to the next. It stops before a
   * shot with a camera move of its own, with a warning.
   */
  private async heldThrough(result: OperationResult, subject: CameraSubject, change: CameraChange, through: string): Promise<OperationResult> {
    const shots = this.shots.shots();
    const first = shots.findIndex((shot) => shot.ref === subject.ref);
    const last = shots.findIndex((shot) => shot.ref === through);
    const problems: OperationProblem[] = [];
    let reached = subject.ref;
    for (const shot of shots.slice(first + 1, last + 1)) {
      const moving = this.cameraOf(ShotVideoLayerId.of(shot.shot.id));
      if (moving !== null && moving.presetId !== HELD_CAMERA_PRESET_ID) {
        problems.push(this.warning(`The punch-in runs through ${reached}, not ${through}: ${shot.ref} has a camera move of its own.`, reached));
        break;
      }
      const each = await this.changed({ target: { kind: 'shot', shotId: shot.shot.id }, styleId: ShotVideoLayerId.of(shot.shot.id), ref: shot.ref }, { ...change, target: shot.ref, preset: HELD_CAMERA_PRESET_ID });
      problems.push(...each.problems);
      if (!each.ok) break;
      reached = shot.ref;
    }
    const count = shots.findIndex((shot) => shot.ref === reached) - first + 1;
    return { ...result, output: { ...(result.output as Record<string, unknown>), through: reached, shots: count }, problems: [...result.problems, ...problems] };
  }

  /** Why the camera of `subject` cannot be told to run through the shot `through` names; null where it can. */
  private throughProblem(subject: CameraSubject, through: string): OperationProblem | null {
    if (subject.target.kind !== 'shot') {
      return this.problem(`${subject.ref} is a layer: its camera lasts as long as the layer shows, which set_layer's through sets. Only a shot's camera takes through here.`, subject.ref);
    }
    const last = this.shots.resolveShot(through);
    if (!last.ok) return last.problem;
    const own = this.shots.resolveShot(subject.ref);
    if (own.ok && last.value.index < own.value.index) {
      return this.problem(`${through} comes before ${subject.ref}: a camera runs from its own shot through a later one.`, through);
    }
    return null;
  }

  /**
   * `result` after the camera of the shot `shotId` was told to run through
   * the shot `through` names: saying how far it now runs, with a warning
   * where it stopped short of what was asked.
   */
  private ranThrough(result: OperationResult, shotId: string, through: string): OperationResult {
    const asked = this.shots.resolveShot(through);
    if (asked.ok) this.setVideoThrough.execute(shotId, asked.value.shot.id);
    const run = this.store.snapshot().shots.videoRunOf(shotId);
    const last = run[run.length - 1];
    if (last === undefined) return result;
    const reached = this.parser.formatOf('shot', last.id);
    const short = asked.ok && asked.value.shot.id !== last.id
      ? [this.warning(`The camera runs through ${reached}, not ${through}: it has no move to carry on, or the shot after ${reached} has a camera or a framing of its own, which draws itself.`, reached)]
      : [];
    return {
      ...result,
      output: { ...(result.output as Record<string, unknown>), through: reached, shots: run.length },
      problems: [...result.problems, ...short],
    };
  }

  /** Gives the camera of `subject` the move and the settings asked, changes the one it has, or takes it off. */
  private async changed(subject: CameraSubject, change: CameraChange): Promise<OperationResult> {
    const { target, preset, sound, ...settings } = change;
    const held = this.cameraOf(subject.styleId);
    if (held !== null && this.isTakenOver(subject.styleId, held)) {
      return this.refused([this.problem(
        `The camera of ${target} is written by hand in its CSS, so moves cannot be picked for it; change it with set_element_css, or clear that CSS first.`,
        target,
      )]);
    }
    const point = this.pointLookedAt(subject);
    if (preset === null) return this.takenOff(subject, settings, point, this.placeKept(subject, false));
    const place = this.placeKept(subject, true);
    const move = this.moveOf(preset, held, target);
    if (!move.ok) return this.refused([move.problem]);
    const unsupported = this.unsupported(move.value, settings);
    if (unsupported.length > 0) return this.refused(unsupported.map((message) => this.problem(message, target)));
    const widened = this.widenedBy(subject, move.value);
    if (widened !== null) return this.refused([widened]);
    this.apply(subject, move.value, settings, sound, point, place);
    if (preset !== undefined) this.slowedDown(subject, move.value, settings);
    return this.answered(subject);
  }

  /**
   * The point of the source picture a shot's video looks at now, on each
   * axis it places itself on (null on an axis it leaves to the output
   * frame's crop, and for a layer): read off the closer end of its camera.
   */
  private pointLookedAt(subject: CameraSubject): PicturePoint | null {
    if (subject.target.kind !== 'shot') return null;
    const state = this.store.snapshot();
    const camera = this.area.cameraOf(state, subject.target.shotId);
    const framing = camera.end.scale > camera.start.scale ? camera.end : camera.start;
    if (framing.x === null && framing.y === null) return null;
    const span = this.area.spanOf(state);
    return {
      x: framing.x === null ? null : this.aimPoint.pointOf(framing.x, this.aimPoint.sideOf(framing.scale, span.x)),
      y: framing.y === null ? null : this.aimPoint.pointOf(framing.y, this.aimPoint.sideOf(framing.scale, span.y)),
    };
  }

  /**
   * The share the closer end of a shot's camera holds along each axis the
   * output frame shows whole at its own closeness (null where it holds
   * none, on an axis the frame crops, and for a layer). `whileWhole`
   * leaves out an axis the camera is already closer on, where the share
   * places a view. On an axis the view shows whole the share moves
   * nothing and says where the subject is, as a reframe leaves a person's
   * head: a view that closes in keeping it leaves the subject where it
   * was in the frame, rather than closing in on the frame's middle.
   */
  private placeKept(subject: CameraSubject, whileWhole: boolean): PicturePoint {
    if (subject.target.kind !== 'shot') return { x: null, y: null };
    const state = this.store.snapshot();
    const camera = this.area.cameraOf(state, subject.target.shotId);
    const framing = camera.end.scale > camera.start.scale ? camera.end : camera.start;
    const span = this.area.spanOf(state);
    const kept = (share: number | null, axisSpan: number): number | null => {
      if (axisSpan > 1) return null;
      return whileWhole && this.aimPoint.sideOf(framing.scale, axisSpan) < 1 ? null : share;
    };
    return { x: kept(framing.x, span.x), y: kept(framing.y, span.y) };
  }

  private subjectOf(ref: string): ResolvedRef<CameraSubject> {
    if (ref.startsWith('shot:')) {
      const shot = this.shots.resolveShot(ref);
      if (!shot.ok) return shot;
      const shotId = shot.value.shot.id;
      return { ok: true, value: { target: { kind: 'shot', shotId }, styleId: ShotVideoLayerId.of(shotId), ref: shot.value.ref } };
    }
    if (!ref.startsWith('layer:')) {
      return { ok: false, problem: this.problem(`"${ref}" is not a shot or layer ref; give shot:<id> or layer:<id>.`, ref) };
    }
    const layer = this.shots.resolveLayer(ref);
    if (!layer.ok) return layer;
    if ('graphic' in layer.value.layer) {
      return { ok: false, problem: this.problem(`${ref} is a graphic, which has no camera; a camera moves a shot's video or a b-roll or picture layer.`, ref) };
    }
    const layerId = layer.value.layer.id;
    return { ok: true, value: { target: { kind: 'layer', layerId }, styleId: layerId, ref: layer.value.ref } };
  }

  /** The move a run works on: the one named, or the one held where none is named. */
  private moveOf(presetId: string | undefined, held: ElementAnimation | null, ref: string): ResolvedRef<ElementAnimationPreset> {
    const moves = this.moves();
    if (presetId === undefined) {
      const kept = held?.presetId ? moves.find((move) => move.id === held.presetId) : undefined;
      return kept === undefined
        ? { ok: false, problem: this.problem(`${ref} has no camera move yet: give a preset.`, ref) }
        : { ok: true, value: kept };
    }
    const move = moves.find((candidate) => candidate.id === presetId);
    if (move !== undefined) return { ok: true, value: move };
    return {
      ok: false,
      problem: this.problem(`"${presetId}" is not a camera move. Moves: ${moves.map((each) => each.id).join(', ')}.`, ref),
    };
  }

  /** Why each setting given cannot be written on `move`; empty when all can. */
  private unsupported(move: ElementAnimationPreset, settings: CameraSettings): string[] {
    const reasons: string[] = [];
    const zooms = this.zoomControlOf(move) !== null;
    const pans = this.controlOf(move, ShotCameraVariable.START_X) !== null;
    const bounces = this.controlOf(move, ShotCameraVariable.ANCHOR_X) !== null;
    const aimed = settings.x !== undefined || settings.y !== undefined;
    if (settings.scale !== undefined && !zooms) reasons.push(`${move.id} has no zoom of its own: scale does not apply${this.hasIntensity(move) ? '; set intensity' : ''}.`);
    if (aimed && !zooms && !bounces) reasons.push(`${move.id} has no aim: x and y do not apply.`);
    if (settings.x !== undefined && pans) reasons.push(`${move.id} travels across the picture: give fromX and toX instead of x.`);
    if ((settings.fromX !== undefined || settings.toX !== undefined) && !pans) reasons.push('fromX and toX are for pans only.');
    if (settings.durationSec !== undefined && this.controlOf(move, ShotCameraVariable.DURATION) === null) {
      const timed = this.moves().filter((each) => this.controlOf(each, ShotCameraVariable.DURATION) !== null).map((each) => each.id);
      reasons.push(`${move.id} lasts the whole shot: durationSec applies to ${timed.join(', ')}.`);
    }
    if (settings.intensity !== undefined && !this.hasIntensity(move)) reasons.push(`${move.id} has no intensity: it applies to a bounce or a shake.`);
    return reasons;
  }

  /** Takes the camera off, keeping where a shot looked at the frame's own closeness, and along an axis that view shows whole the share it held (`place`). */
  private takenOff(subject: CameraSubject, settings: CameraSettings, point: PicturePoint | null, place: PicturePoint): OperationResult {
    const given = Object.entries(settings).filter(([, value]) => value !== undefined).map(([key]) => key);
    if (given.length > 0) {
      return this.refused([this.problem(`preset null takes the camera off: ${given.join(', ')} cannot be set with it.`, subject.ref)]);
    }
    this.setCamera.pick(subject.target, null);
    if (point !== null) {
      const whole = this.framingAt(1, point);
      this.setCamera.place(subject.target, 'start', whole.x ?? place.x, whole.y ?? place.y);
    }
    return this.answered(subject);
  }

  /**
   * Why `move` cannot replace the camera of a shot held closer than the
   * frame (a punch-in, such as a reframe's on one person of a wide
   * picture): every other move starts from the frame's own closeness or
   * shakes about it, so the shot would first widen. Null where it can.
   */
  private widenedBy(subject: CameraSubject, move: ElementAnimationPreset): OperationProblem | null {
    if (subject.target.kind !== 'shot' || move.id === HELD_CAMERA_PRESET_ID) return null;
    const camera = this.area.cameraOf(this.store.snapshot(), subject.target.shotId);
    if (camera.presetId !== HELD_CAMERA_PRESET_ID || !(camera.start.scale > 1)) return null;
    return this.problem(
      `${subject.ref} is framed closer than the frame (a punch-in at ${this.rounded(camera.start.scale)}), so ${move.id} would first widen it. To bring it closer, give ${HELD_CAMERA_PRESET_ID} a higher scale; or leave its camera as it is.`,
      subject.ref,
    );
  }

  private apply(subject: CameraSubject, move: ElementAnimationPreset, settings: CameraSettings, sound: boolean, point: PicturePoint | null, place: PicturePoint): void {
    this.setCamera.pick(subject.target, move.id);
    if (settings.durationSec !== undefined) this.setCamera.setDuration(subject.target, settings.durationSec);
    this.aim(subject, move, settings, point, place);
    this.setParam(subject, move, ShotCameraVariable.START_X, settings.fromX);
    this.setParam(subject, move, ShotCameraVariable.END_X, settings.toX);
    this.setParam(subject, move, ShotCameraVariable.INTENSITY, settings.intensity);
    if (!sound) {
      const clip = this.cameraSounds.clipIn(this.store.snapshot().audio, subject.target, move.id);
      if (clip !== null) this.removeClips.execute([clip.id]);
    }
  }

  /**
   * Gives a pan just picked on a layer, with no travel asked, the travel
   * that drifts slowly about the picture's middle for as long as the layer
   * shows, in the direction the move goes: its own travel, from one edge
   * of what the box leaves out to the other, is a swipe on a picture much
   * wider than its box. Nothing where the layer's shape or length is not
   * known.
   */
  private slowedDown(subject: CameraSubject, move: ElementAnimationPreset, settings: CameraSettings): void {
    const from = this.controlOf(move, ShotCameraVariable.START_X);
    const to = this.controlOf(move, ShotCameraVariable.END_X);
    const zoom = this.zoomControlOf(move);
    if (subject.target.kind !== 'layer' || from === null || to === null || zoom === null) return;
    if (settings.fromX !== undefined || settings.toX !== undefined) return;
    const scale = this.valueOf(this.cameraOf(subject.styleId), zoom);
    const share = this.panPace.slowShareOf(this.store.snapshot(), subject.target.layerId, scale);
    if (share === null) return;
    const half = (this.defaultOf(to) < this.defaultOf(from) ? -share : share) / 2;
    this.setLayerAnimation.setParam([subject.styleId], CAMERA, from.id, this.rounded(0.5 - half));
    this.setLayerAnimation.setParam([subject.styleId], CAMERA, to.id, this.rounded(0.5 + half));
  }

  /** How far and for how long a layer's pan travels, in words; null for any other camera, or where it cannot be told. */
  private travelOf(subject: CameraSubject, move: ElementAnimationPreset, animation: ElementAnimation): string | null {
    const from = this.controlOf(move, ShotCameraVariable.START_X);
    const to = this.controlOf(move, ShotCameraVariable.END_X);
    const zoom = this.zoomControlOf(move);
    if (subject.target.kind !== 'layer' || from === null || to === null || zoom === null) return null;
    const travel = this.panPace.travelOf(
      this.store.snapshot(), subject.target.layerId, this.valueOf(animation, zoom), this.valueOf(animation, from), this.valueOf(animation, to),
    );
    if (travel === null) return null;
    return `${Math.round(travel.frameWidths * 100)}% of the frame's width in ${travel.lengthSec.toFixed(1)} s`;
  }

  /**
   * Writes the zoom and the aim: a bounce's point, or the framing of
   * the close end of a move, whose other end the camera lines up with
   * it; what is not given keeps what the move holds now. A shot is aimed
   * at a point of the picture: the one given, else `point`, the one it
   * looked at before the move was picked. On an axis given no aim where
   * `place` holds a share, the close end keeps that share instead, so
   * what sits there stays where it is in the frame as the view closes in.
   */
  private aim(subject: CameraSubject, move: ElementAnimationPreset, settings: CameraSettings, point: PicturePoint | null, place: PicturePoint): void {
    const { scale, x, y } = settings;
    if (scale === undefined && x === undefined && y === undefined && point === null) return;
    const animation = this.cameraOf(subject.styleId);
    const anchorX = this.controlOf(move, ShotCameraVariable.ANCHOR_X);
    const anchorY = this.controlOf(move, ShotCameraVariable.ANCHOR_Y);
    if (anchorX !== null && anchorY !== null) {
      if (scale === undefined && x === undefined && y === undefined) return;
      this.setCamera.setEffectAnchor(subject.target, {
        x: x === undefined ? this.valueOf(animation, anchorX) : x ?? this.defaultOf(anchorX),
        y: y === undefined ? this.valueOf(animation, anchorY) : y ?? this.defaultOf(anchorY),
      });
      return;
    }
    const zoom = this.zoomControlOf(move);
    if (zoom === null) return;
    const end: ShotCameraEnd = this.controlOf(move, ShotCameraVariable.END_SCALE) === null ? 'start' : 'end';
    const ids = end === 'start' ? ShotVideoFraming.POSITION_FIELD_IDS : ShotVideoFraming.END_POSITION_FIELD_IDS;
    const fields = this.store.snapshot().shots.layerStyles.get(subject.styleId)?.fields;
    const pans = this.controlOf(move, ShotCameraVariable.START_X) !== null;
    const newScale = scale ?? this.valueOf(animation, zoom);
    if (subject.target.kind !== 'shot') {
      const aimX = pans ? null : x === undefined ? this.fieldOf(fields, ids.x) : x;
      const aimY = y === undefined ? this.fieldOf(fields, ids.y) : y;
      this.setCamera.setFraming(subject.target, end, ShotVideoFraming.at(newScale, aimX, aimY));
      return;
    }
    const aimed: PicturePoint = {
      x: pans ? null : x === undefined ? point?.x ?? null : x,
      y: y === undefined ? point?.y ?? null : y,
    };
    const centred = this.framingAt(newScale, aimed);
    this.setCamera.setFraming(subject.target, end, ShotVideoFraming.at(
      newScale,
      x === undefined && !pans && place.x !== null ? place.x : centred.x,
      y === undefined && place.y !== null ? place.y : centred.y,
    ));
    if (this.closesInFromTheFrame(move)) this.lineUpWholeEnd(subject, end === 'start' ? 'end' : 'start', aimed);
  }

  /**
   * Points the whole-frame end of a zoom at `point` on every axis where
   * a view at the frame's own closeness still has somewhere to look (the
   * axis the output frame crops); elsewhere it keeps what it holds.
   */
  private lineUpWholeEnd(subject: CameraSubject, wholeEnd: ShotCameraEnd, point: PicturePoint): void {
    const whole = this.framingAt(1, point);
    if (whole.x === null && whole.y === null) return;
    const ids = wholeEnd === 'start' ? ShotVideoFraming.POSITION_FIELD_IDS : ShotVideoFraming.END_POSITION_FIELD_IDS;
    const fields = this.store.snapshot().shots.layerStyles.get(subject.styleId)?.fields;
    this.setCamera.place(subject.target, wholeEnd, whole.x ?? this.fieldOf(fields, ids.x), whole.y ?? this.fieldOf(fields, ids.y));
  }

  /** The framing at `scale` whose view is centred as near `point` as the picture allows, as the shares it is kept in. */
  private framingAt(scale: number, point: PicturePoint): ShotVideoFraming {
    const span = this.area.spanOf(this.store.snapshot());
    const share = (at: number | null, axisSpan: number): number | null => (at === null ? null : this.aimPoint.shareOf(at, this.aimPoint.sideOf(scale, axisSpan)));
    return ShotVideoFraming.at(scale, share(point.x, span.x), share(point.y, span.y));
  }

  /**
   * Whether `move` goes from the frame's own closeness to a closer one,
   * or back (a zoom in, a pull-out), so its whole-frame end must look at
   * the same point as its close one, or the view drifts on the way.
   */
  private closesInFromTheFrame(move: ElementAnimationPreset): boolean {
    if (move.id === HELD_CAMERA_PRESET_ID || this.controlOf(move, ShotCameraVariable.START_X) !== null) return false;
    return this.zoomControlOf(move) !== null;
  }

  private setParam(subject: CameraSubject, move: ElementAnimationPreset, property: ShotCameraVariable, value: number | undefined): void {
    const control = this.controlOf(move, property);
    if (value === undefined || control === null) return;
    this.setLayerAnimation.setParam([subject.styleId], CAMERA, control.id, value);
  }

  private answered(subject: CameraSubject): OperationResult {
    const state = this.store.snapshot();
    const style = state.shots.layerStyles.get(subject.styleId);
    const animation = style?.animations?.[CAMERA];
    const move = animation?.presetId ? this.presets.byId(animation.presetId) : null;
    const sounds = this.cameraSounds.clipsOn(state.audio, subject.target).map((clip) => this.parser.formatOf('sound', clip.id));
    return {
      ok: true,
      output: {
        target: subject.ref,
        camera: animation === undefined || move === null ? null : this.settingsOf(move, animation, style?.fields, subject.target.kind === 'shot'),
        ...(subject.target.kind === 'shot' ? { shows: this.showsOf(subject.target.shotId) } : {}),
        ...(animation === undefined || move === null ? {} : this.travelled(this.travelOf(subject, move, animation))),
        sounds,
      },
      problems: [],
    };
  }

  private travelled(travel: string | null): { readonly travels?: string } {
    return travel === null ? {} : { travels: travel };
  }

  /** The part of the source picture the shot shows, in words: at its start, and at its end where the camera moves. */
  private showsOf(shotId: string): string {
    const state = this.store.snapshot();
    const camera = this.area.cameraOf(state, shotId);
    const start = this.describeArea(this.area.areaOf(state, camera.start));
    const end = this.describeArea(this.area.areaOf(state, camera.end));
    return start === end ? start : `${start}, moving to ${end}`;
  }

  private describeArea(area: PictureArea): string {
    const percent = (share: number): number => Math.round(share * 100);
    return `${percent(area.left)}% to ${percent(area.left + area.width)}% of the picture's width, ${percent(area.top)}% to ${percent(area.top + area.height)}% of its height`;
  }

  /** The camera as a caller sets it: the move and every setting it has, read back. */
  private settingsOf(move: ElementAnimationPreset, animation: ElementAnimation, fields: ElementFieldValues | undefined, aimedAtPoint: boolean): Record<string, unknown> {
    const settings: Record<string, unknown> = { preset: move.id };
    const read = (property: ShotCameraVariable): number | null => {
      const control = this.controlOf(move, property);
      return control === null ? null : this.rounded(this.valueOf(animation, control));
    };
    const zoom = this.zoomControlOf(move);
    if (zoom !== null) settings['scale'] = this.rounded(this.valueOf(animation, zoom));
    if (this.controlOf(move, ShotCameraVariable.ANCHOR_X) !== null) {
      settings['x'] = read(ShotCameraVariable.ANCHOR_X);
      settings['y'] = read(ShotCameraVariable.ANCHOR_Y);
    } else if (zoom !== null) {
      const ids = this.controlOf(move, ShotCameraVariable.END_SCALE) === null ? ShotVideoFraming.POSITION_FIELD_IDS : ShotVideoFraming.END_POSITION_FIELD_IDS;
      const pans = this.controlOf(move, ShotCameraVariable.START_X) !== null;
      const scale = this.valueOf(animation, zoom);
      const span = this.area.spanOf(this.store.snapshot());
      const readAlong = (fieldId: string, axisSpan: number): number | null => {
        const share = this.fieldOf(fields, fieldId);
        if (share === null || !aimedAtPoint) return share;
        return this.aimPoint.pointOf(share, this.aimPoint.sideOf(scale, axisSpan));
      };
      if (!pans) settings['x'] = this.roundedOrNull(readAlong(ids.x, span.x));
      settings['y'] = this.roundedOrNull(readAlong(ids.y, span.y));
    }
    for (const [key, property] of [
      ['fromX', ShotCameraVariable.START_X],
      ['toX', ShotCameraVariable.END_X],
      ['durationSec', ShotCameraVariable.DURATION],
      ['intensity', ShotCameraVariable.INTENSITY],
    ] as const) {
      const value = read(property);
      if (value !== null) settings[key] = value;
    }
    return settings;
  }

  /** The library's camera moves. */
  private moves(): ReadonlyArray<ElementAnimationPreset> {
    return this.presets.forClock('layer', LayerCssVariable.CAMERA_CLOCK);
  }

  private cameraOf(styleId: string): ElementAnimation | null {
    return this.store.snapshot().shots.layerStyles.get(styleId)?.animations?.[CAMERA] ?? null;
  }

  private isTakenOver(styleId: string, camera: ElementAnimation): boolean {
    const css = this.store.snapshot().shots.layerStyles.get(styleId)?.css ?? '';
    return this.animations.isTakenOver(css, 'layer', CAMERA, camera);
  }

  /** The field that sets how close `move` gets, at whichever end it does. */
  private zoomControlOf(move: ElementAnimationPreset): ElementControl | null {
    return this.controlOf(move, ShotCameraVariable.START_SCALE) ?? this.controlOf(move, ShotCameraVariable.END_SCALE);
  }

  private hasIntensity(move: ElementAnimationPreset): boolean {
    return this.controlOf(move, ShotCameraVariable.INTENSITY) !== null;
  }

  private controlOf(move: ElementAnimationPreset, property: ShotCameraVariable): ElementControl | null {
    return move.controls.find((control) => control.property === property) ?? null;
  }

  /** What `control` holds on `animation`: the value set by hand, or the move's own. */
  private valueOf(animation: ElementAnimation | null, control: ElementControl): number {
    const held = animation?.params[control.id];
    return typeof held === 'number' ? held : this.defaultOf(control);
  }

  private defaultOf(control: ElementControl): number {
    return typeof control.defaultValue === 'number' ? control.defaultValue : 0;
  }

  private fieldOf(fields: ElementFieldValues | undefined, fieldId: string): number | null {
    const held = fields?.[fieldId];
    return typeof held === 'number' && Number.isFinite(held) ? held : null;
  }

  private rounded(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundedOrNull(value: number | null): number | null {
    return value === null ? null : this.rounded(value);
  }

  private problem(message: string, ref: string): OperationProblem {
    return { severity: 'error', message, ref };
  }

  private warning(message: string, ref: string): OperationProblem {
    return { severity: 'warning', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
