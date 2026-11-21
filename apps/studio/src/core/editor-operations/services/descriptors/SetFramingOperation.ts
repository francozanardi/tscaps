import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ProjectShot, ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SetShotCameraAction } from '@core/shots/actions/SetShotCameraAction';
import { HELD_CAMERA_PRESET_ID } from '@core/shots/domain/HeldCameraPreset';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ShotAimPoint } from '@core/shots/services/ShotAimPoint';
import type { ShotPictureArea } from '@core/shots/services/ShotPictureArea';

const CAMERA = ElementAnimationScope.CAMERA;
const MAX_SHOTS = 60;

/**
 * `set_framing`: holds where the given shots' own videos look, the same
 * for all of them so they do not jump where they meet: the point of the
 * source picture put in the middle of the output frame (stopped at the
 * picture's edge), and how close. At the frame's own closeness a shot
 * keeps no camera move, only where it looks; closer, it holds a punch-in.
 * A camera move a shot had is replaced, and the answer names it.
 */
export class SetFramingOperation implements EditorOperation {
  readonly name = 'set_framing';
  readonly effect = 'edit';
  readonly description = [
    'Frame shots: hold where each listed shot\'s own video looks for the whole shot, the same for all of them, so shots cut from one stretch of the video do not jump where they meet.',
    'x and y are the point of the whole source picture put in the middle of the output frame (0 its left or top edge, 1 its right or bottom edge); near an edge the frame stops at the edge.',
    'scale 1 keeps the frame\'s own closeness (a wide video in a 9:16 frame then shows about a third of its width); more is closer.',
    'Along an axis the frame shows whole at that scale nothing moves, and the point is kept as where the subject is: every zoom set later with set_camera closes in on it and leaves it where it was in the frame. So framing the shots on the speaker\'s face, at scale 1, is how a video that needs no crop is told where its person is.',
    'A camera move a shot had (a zoom, a pan) is replaced by the framing; set it again afterwards with set_camera, which keeps aiming at the point.',
  ].join(' ');

  private readonly input = new OperationInput({
    shots: z.array(z.string()).min(1).max(MAX_SHOTS).describe('The shots to frame alike, as refs: shot:<id>.'),
    x: z.number().min(0).max(1).describe('The point across the source picture to centre: 0 its left edge, 0.5 its middle, 1 its right edge.'),
    y: z.number().min(0).max(1).nullable().optional().describe('The point down the source picture to centre: 0 its top, 1 its bottom. Leave it out or null to keep where the output frame crops (its middle).'),
    scale: z.number().min(1).max(3).default(1).describe('How close: 1 is the output frame\'s own closeness; 1.4 shows one person of a wide picture closer.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly presets: ElementAnimationCatalog,
    private readonly animations: ElementAnimationCssWriter,
    private readonly setCamera: SetShotCameraAction,
    private readonly area: ShotPictureArea,
    private readonly aimPoint: ShotAimPoint,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { shots: refs, x, y, scale } = checked.value;
    const resolved = this.shotsOf(refs);
    if (!resolved.ok) return this.refused(resolved.problems);
    const held = this.heldPreset();
    if (scale > 1 && held === null) return this.refused([this.error('The camera library has no move that holds one framing, so no shot can be framed closer than the frame.')]);
    const framing = this.framingOf(x, y ?? null, scale);
    const problems: OperationProblem[] = [];
    const framed: string[] = [];
    for (const shot of resolved.shots) {
      const styleId = ShotVideoLayerId.of(shot.shot.id);
      if (this.isTakenOver(styleId)) {
        problems.push(this.warning(`${shot.ref} keeps its camera, written by hand in its CSS.`, shot.ref));
        continue;
      }
      const replaced = this.movingPresetOf(styleId);
      if (replaced !== null) problems.push(this.warning(`${shot.ref} had a camera move (${replaced}), replaced by the framing.`, shot.ref));
      this.hold(shot, framing, held);
      framed.push(shot.ref);
    }
    return { ok: framed.length > 0, output: framed.length > 0 ? { framed, shows: this.showsOf(framing) } : null, problems };
  }

  /** Every shot `refs` names, or the problems of the ones that name none. */
  private shotsOf(refs: ReadonlyArray<string>): { ok: true; shots: ProjectShot[] } | { ok: false; problems: OperationProblem[] } {
    const shots: ProjectShot[] = [];
    const problems: OperationProblem[] = [];
    for (const ref of new Set(refs)) {
      const shot = this.shots.resolveShot(ref);
      if (shot.ok) shots.push(shot.value);
      else problems.push(shot.problem);
    }
    return problems.length > 0 ? { ok: false, problems } : { ok: true, shots };
  }

  /**
   * The framing that puts the point (`x`, `y`) in the middle of the frame
   * at `scale`, as the shares it is kept in. Along an axis a view at
   * `scale` shows whole there is nothing to move: the point is kept as it
   * is, which is the share a closer view keeps in place.
   */
  private framingOf(x: number, y: number | null, scale: number): ShotVideoFraming {
    const span = this.area.spanOf(this.store.snapshot());
    const along = (point: number, axisSpan: number): number => this.aimPoint.shareOf(point, this.aimPoint.sideOf(scale, axisSpan)) ?? point;
    return ShotVideoFraming.at(scale, along(x, span.x), y === null ? null : along(y, span.y));
  }

  /** Writes `framing` on `shot`: no camera at the frame's closeness, the held move closer. */
  private hold(shot: ProjectShot, framing: ShotVideoFraming, held: ElementAnimationPreset | null): void {
    const target = { kind: 'shot', shotId: shot.shot.id } as const;
    if (framing.scale === 1 || held === null) {
      this.setCamera.pick(target, null);
      this.setCamera.place(target, 'start', framing.x, framing.y);
      return;
    }
    this.setCamera.pick(target, held.id);
    this.setCamera.setFraming(target, 'start', framing);
  }

  /** The library's camera move that holds one framing for the whole shot (a punch-in), or null where it has none. */
  private heldPreset(): ElementAnimationPreset | null {
    return this.presets.byId(HELD_CAMERA_PRESET_ID);
  }

  /** The id of the camera move the shot's video has, where it is any but the held one; null otherwise. */
  private movingPresetOf(styleId: string): string | null {
    const presetId = this.store.snapshot().shots.layerStyles.get(styleId)?.animations?.[CAMERA]?.presetId ?? null;
    return presetId === null || presetId === HELD_CAMERA_PRESET_ID ? null : presetId;
  }

  private isTakenOver(styleId: string): boolean {
    const style = this.store.snapshot().shots.layerStyles.get(styleId);
    const camera = style?.animations?.[CAMERA];
    return camera !== undefined && this.animations.isTakenOver(style?.css ?? '', 'layer', CAMERA, camera);
  }

  /** The part of the source picture the framing shows, in words. */
  private showsOf(framing: ShotVideoFraming): string {
    const shown = this.area.areaOf(this.store.snapshot(), framing);
    const percent = (share: number): number => Math.round(share * 100);
    return `${percent(shown.left)}% to ${percent(shown.left + shown.width)}% of the picture's width, ${percent(shown.top)}% to ${percent(shown.top + shown.height)}% of its height`;
  }

  private warning(message: string, ref: string): OperationProblem {
    return { severity: 'warning', message, ref };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
