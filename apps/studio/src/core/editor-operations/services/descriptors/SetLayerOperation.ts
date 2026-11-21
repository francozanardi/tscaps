import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { GraphicFillCheck } from '@core/editor-operations/services/GraphicFillCheck';
import type { LayerRunWriter } from '@core/editor-operations/services/LayerRunWriter';
import type { LayerTransitionWriter } from '@core/editor-operations/services/LayerTransitionWriter';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { InsetTransitionDurationField } from '@core/elements/domain/fields/InsetTransitionDurationField';
import { SplitTransitionDurationField } from '@core/elements/domain/fields/SplitTransitionDurationField';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PatchShotLayersAction } from '@core/shots/actions/PatchShotLayersAction';
import type { ShotFileLayer, ShotLayer } from '@core/shots/domain/ShotLayer';
import type {
  ShotLayerPatch,
  ShotLayerPlacementPatch,
  ShotLayerPlacementSettings,
  ShotLayerTimingPatch,
} from '@core/shots/domain/ShotLayerPatch';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { SHOT_LAYER_PLACEMENT_RANGES as RANGES } from '@core/shots/domain/ShotLayerPlacementRanges';
import type { ShotLayerPatcher } from '@core/shots/services/ShotLayerPatcher';

// Every layout takes these three: declared once in the schema the model reads (`id` puts them under $defs).
const FIT = z.enum(['cover', 'contain'])
  .meta({ id: 'LayerFit', description: 'How a file fills its box: cover fills it and crops what overflows, contain shows the whole file.' })
  .optional();
const BACKDROP = z.enum(['black', 'blur'])
  .meta({ id: 'LayerBackdrop', description: 'What fills the box around a file shown with fit contain: black, or the file itself blurred.' })
  .optional();
const POSITION = z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .meta({ id: 'LayerCropPosition', description: 'Where a file shown with fit cover is cropped, per axis: 0 keeps its left (top) edge, 0.5 its centre, 1 its right (bottom) edge.' })
  .optional();
const CORNER_RADIUS = z.number().min(RANGES.cornerRadius.min).max(RANGES.cornerRadius.max).optional()
  .describe('The corners\' radius, as a share of the frame\'s shorter side.');
const CENTER = z.number().min(RANGES.center.min).max(RANGES.center.max).optional();
// The Layout tab's duration sliders, read off the fields the durations are recorded in: a range both allow.
const SPLIT_DURATION = new SplitTransitionDurationField('entrance').controlFor();
const INSET_DURATION = new InsetTransitionDurationField('entrance').controlFor();
const TRANSITION = z.strictObject({
  kind: z.enum(['cut', 'slide', 'reveal', 'full']).optional(),
  durationSec: z.number()
    .min(Math.max(SPLIT_DURATION.min ?? 0, INSET_DURATION.min ?? 0))
    .max(Math.min(SPLIT_DURATION.max ?? Infinity, INSET_DURATION.max ?? Infinity))
    .optional(),
}).meta({
  id: 'LayerTransition',
  description: 'How the layout plays as the layer comes in or leaves: cut, at once; a split\'s slide (its part slides in with the line) or reveal (the line uncovers it); an inset\'s full (from the whole frame into the box, and back). A slide or a full is the way in or out already: add no entrance or exit motion on top.',
}).optional();

const LAYOUT = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('full').describe('Covers the whole frame; the video is hidden under it, or shows through what a graphic leaves unpainted.'),
    fit: FIT,
    backdrop: BACKDROP,
    position: POSITION,
  }),
  z.strictObject({
    kind: z.literal('split').describe('Shares the frame with the video: the frame is cut in two across its long side (top and bottom on a vertical or square frame), the layer fills one part and the video is re-framed into the other.'),
    assetSide: z.enum(['start', 'end']).optional().describe('The part the layer takes: start is the top (the left on a horizontal frame), end the bottom (the right).'),
    assetRatio: z.number().min(RANGES.splitAssetRatio.min).max(RANGES.splitAssetRatio.max).optional()
      .describe('The share of the frame\'s long side the layer\'s part takes.'),
    padding: z.number().min(RANGES.splitPadding.min).max(RANGES.splitPadding.max).optional()
      .describe('A margin around the layer inside its part, as a share of the frame\'s shorter side.'),
    cornerRadius: CORNER_RADIUS,
    fit: FIT,
    backdrop: BACKDROP,
    position: POSITION,
    entrance: TRANSITION,
    exit: TRANSITION,
  }),
  z.strictObject({
    kind: z.literal('inset').describe('A box floating over the video: a picture in picture, or a graphic\'s box.'),
    subject: z.enum(['asset', 'video']).optional()
      .describe('What floats in the box: asset, the layer over the video (the default), or video, the video over the layer, which then fills the frame.'),
    centerX: CENTER.describe('The box\'s centre across the frame: 0 is the left edge, 1 the right.'),
    centerY: CENTER.describe('The box\'s centre down the frame: 0 is the top edge, 1 the bottom.'),
    width: z.number().min(RANGES.insetWidth.min).max(RANGES.insetWidth.max).optional()
      .describe('The box\'s width, as a share of the frame\'s width.'),
    aspectRatio: z.number().min(RANGES.aspectRatio.min).max(RANGES.aspectRatio.max).nullable().optional()
      .describe('The box\'s width over its height; null for the shape of what floats in it (a file\'s own shape, a graphic\'s aspectRatio).'),
    padding: z.number().min(RANGES.insetPadding.min).max(RANGES.insetPadding.max).optional()
      .describe('The least distance kept between the box and the frame\'s edges, as a share of the frame\'s shorter side; a box that would cross it is pushed back inside, or shrunk.'),
    cornerRadius: CORNER_RADIUS,
    fit: FIT,
    backdrop: BACKDROP,
    position: POSITION,
    entrance: TRANSITION,
    exit: TRANSITION,
  }),
]);

type LayoutInput = z.output<typeof LAYOUT>;

const TIMING = z.strictObject({
  inSec: z.number().min(0).optional().describe('Where in the file playback starts, in seconds from the file\'s own start.'),
  outSec: z.number().positive().nullable().optional().describe('Where in the file playback stops, in seconds from the file\'s own start; null plays to the file\'s end.'),
  loop: z.boolean().optional().describe('Whether the stretch starts over for as long as the layer shows, where it is shorter than that.'),
});

type TimingInput = z.output<typeof TIMING>;

// What a graphic has no use for: it draws itself to fill its box, and nothing floats in its place.
const FILE_ONLY_SETTINGS = ['subject', 'fit', 'backdrop', 'position'] as const;
const TRANSITION_EDGES = ['entrance', 'exit'] as const;
// Read-back values are rounded to a ten-thousandth of the frame; closer than this is the value given.
const SAME_VALUE_TOLERANCE = 1e-3;
const CENTRED = { x: 0.5, y: 0.5 };

/** What a layer shows, as far as laying it out goes: a graphic, a file of a known type, or a file the media list does not hold. */
type LayerContent = 'graphic' | Exclude<MediaAssetType, 'audio'> | 'missing';

/**
 * `set_layer`: lays one layer out, with the transitions a split or a
 * box plays at its ends, says how far it shows and, for a video, picks
 * which part of its file plays. Only the settings given
 * change: the rest keep the layer's own values, or a layout's defaults
 * where the layer switches to it.
 */
export class SetLayerOperation implements EditorOperation {
  readonly name = 'set_layer';
  readonly effect = 'edit';
  readonly description = [
    'Change how one layer sits in the frame (`layout`), the shots it shows on (`shot`, `through`) and, for a video file, which part of the file it plays (`timing`).',
    'Layouts: full covers the frame; split shares it with the video, the frame cut in two; inset is a box over the video (a picture in picture, or a graphic\'s box).',
    'A graphic takes full or split only where it fills that part as a b-roll does, painted solid over all of it: it is played there first, and refused otherwise. Anything set over the video (a title, a number, a sticker) stays in an inset box, which the person can move and resize on the preview.',
    'Only the settings given change. Positions and sizes are shares of the frame (0 to 1). The layout also becomes where the next b-roll (or picture) placed starts.',
    'A layer always opens with its shot and shows through the shot `through` names, as one layer that enters once and leaves once: to show it for part of a shot, split the shot. `shot` moves it to open on another shot, the same layer with all it holds: a layer is moved, never removed and made again. Entrance and exit motions are set with set_element_animation.',
  ].join(' ');

  private readonly input = new OperationInput({
    layer: z.string().describe('The layer, as a ref: layer:<id>.'),
    layout: LAYOUT.optional().describe([
      'The layout to give the layer. Settings left out keep their values where the layer already has this layout, and start from the layout\'s defaults where it switches to it (how a file fills its box carries over).',
      'A graphic\'s inset box takes centerX, centerY and width, shaped by the graphic\'s aspectRatio unless aspectRatio is set here. fit, backdrop, position and subject are not for a graphic.',
    ].join(' ')),
    timing: TIMING.optional().describe('Which part of a video file the layer plays; only a video has one (a picture, GIF or graphic spans the shots it shows on). Values left out stay as they are; values past the file\'s length are brought back inside it.'),
    shot: z.string().optional().describe('The shot the layer opens on, as a ref: shot:<id>, to move it there. Left out, it stays on its shot.'),
    through: z.string().optional().describe('The last shot the layer shows on, as a ref: shot:<id>: the shot it opens on, or a later one. Left out, it shows as far as it did.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly media: MediaAssetStore,
    private readonly patchLayers: PatchShotLayersAction,
    private readonly patcher: ShotLayerPatcher,
    private readonly runs: LayerRunWriter,
    private readonly fill: GraphicFillCheck,
    private readonly transitions: LayerTransitionWriter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { layer: ref, layout, timing, shot, through } = checked.value;
    if (layout === undefined && timing === undefined && shot === undefined && through === undefined) return this.refused([this.error('Give layout, timing, shot or through.', ref)]);
    const resolved = this.shots.resolveLayer(ref);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const { layer } = resolved.value;
    const runProblem = shot !== undefined
      ? this.runs.moveProblemOf(shot, through)
      : through === undefined ? null : this.runs.problemOf(resolved.value.shot, through);
    if (runProblem !== null) return this.refused([runProblem]);
    const content = this.contentOf(layer);
    const refusals = [...this.layoutRefusals(ref, content, layout), ...this.timingRefusals(ref, content, timing)];
    if (refusals.length > 0) return this.refused(refusals);
    const unfilled = layout === undefined || content !== 'graphic' ? [] : await this.fillRefusals(ref, layer, layout);
    if (unfilled.length > 0) return this.refused(unfilled);
    if (layout !== undefined || timing !== undefined) this.patchLayers.execute([layer.id], this.patchOf(layer, layout, timing));
    if (layout !== undefined) this.writeTransitions(layer.id, layout);
    if (shot !== undefined) this.runs.moveTo(layer.id, shot, through);
    else if (through !== undefined) this.runs.write(layer.id, through);
    return this.answer(ref, layer.id, layout, timing, shot !== undefined, through !== undefined);
  }

  private contentOf(layer: ShotLayer): LayerContent {
    if ('graphic' in layer) return 'graphic';
    const type = this.media.snapshot().get(layer.mediaId)?.type;
    return type === undefined || type === 'audio' ? 'missing' : type;
  }

  /**
   * Why `layout` cannot go on the layer, read from what is given: the
   * settings a graphic has no use for, since it draws itself to fill its
   * box and nothing floats in its place.
   */
  private layoutRefusals(ref: string, content: LayerContent, layout: LayoutInput | undefined): OperationProblem[] {
    if (layout === undefined) return [];
    if (content === 'missing') return [this.missingFile(ref)];
    return [...this.transitionRefusals(ref, layout), ...this.graphicRefusals(ref, content, layout)];
  }

  /** Why a transition given cannot play in `layout`: its kind belongs to the other layout. */
  private transitionRefusals(ref: string, layout: LayoutInput): OperationProblem[] {
    if (layout.kind === 'full') return [];
    const kind = layout.kind;
    return TRANSITION_EDGES.flatMap((edge) => {
      const given = layout[edge]?.kind;
      if (given === undefined || this.transitions.fits(kind, given)) return [];
      return [this.error(`layout.${edge}.kind ${given} is not for ${kind === 'split' ? 'a split: it takes cut, slide or reveal' : 'an inset: it takes cut or full'}.`, ref)];
    });
  }

  private graphicRefusals(ref: string, content: LayerContent, layout: LayoutInput): OperationProblem[] {
    if (content !== 'graphic') return [];
    const given = layout as Readonly<Record<string, unknown>>;
    const fileOnly = FILE_ONLY_SETTINGS.filter((setting) => given[setting] !== undefined);
    if (fileOnly.length === 0) return [];
    return [this.error(`${ref} is a graphic, which draws itself to fill its box: leave out ${fileOnly.join(', ')}.`, ref)];
  }

  /**
   * Why the graphic of `layer` cannot move to the whole frame or a split
   * part of it: it would not fill that part, played there once. A layer
   * already in that layout keeps it unchecked, as a preset drawn for the
   * whole frame or a layout the person picked.
   */
  private async fillRefusals(ref: string, layer: ShotLayer, layout: LayoutInput): Promise<OperationProblem[]> {
    const current = this.store.snapshot().shots.placementOf(layer.id);
    if (layout.kind === 'inset' || layout.kind === current.kind) return [];
    return this.fill.refusalsOf(layer.id, ref, this.patcher.patchedPlacement(current, this.placementPatchOf(layer, layout)));
  }

  private timingRefusals(ref: string, content: LayerContent, timing: TimingInput | undefined): OperationProblem[] {
    if (timing === undefined) return [];
    switch (content) {
      case 'missing': return [this.missingFile(ref)];
      case 'graphic': return [this.error(`${ref} is a graphic: it has no timing and shows for the whole of the shots it is on (through says how far).`, ref)];
      case 'image':
      case 'gif': return [this.error(`${ref} shows a picture or a GIF, which shows for the whole of the shots it is on (through says how far): only a video has a timing.`, ref)];
      case 'video': break;
    }
    if (typeof timing.inSec === 'number' && typeof timing.outSec === 'number' && timing.outSec <= timing.inSec) {
      return [this.error('timing.outSec must come after timing.inSec.', ref)];
    }
    return [];
  }

  private patchOf(layer: ShotLayer, layout: LayoutInput | undefined, timing: TimingInput | undefined): ShotLayerPatch {
    return {
      ...(layout === undefined ? {} : { placement: this.placementPatchOf(layer, layout) }),
      ...(timing === undefined ? {} : { timing: this.timingPatchOf(timing) }),
    };
  }

  private placementPatchOf(layer: ShotLayer, layout: LayoutInput): ShotLayerPlacementPatch {
    const { kind, ...settings } = layout;
    const switching = this.store.snapshot().shots.placementOf(layer.id).kind !== kind;
    // A graphic draws its own corners, so a box it moves into starts square, as the box its preset gives it is.
    const start: Partial<ShotLayerPlacementSettings> = 'graphic' in layer && switching && kind === 'inset' ? { cornerRadius: 0 } : {};
    return { layout: kind, settings: { ...start, ...this.definedOf(settings) } };
  }

  /** Gives the layer `layerId`, laid out as `layout` now, the transitions at its ends `layout` names. */
  private writeTransitions(layerId: string, layout: LayoutInput): void {
    if (layout.kind === 'full') return;
    for (const edge of TRANSITION_EDGES) {
      const transition = layout[edge];
      if (transition !== undefined) this.transitions.write(layerId, layout.kind, edge, transition);
    }
  }

  private timingPatchOf(timing: TimingInput): ShotLayerTimingPatch {
    return {
      ...(timing.inSec === undefined ? {} : { inSec: timing.inSec }),
      ...(timing.outSec === undefined ? {} : { outSec: timing.outSec }),
      ...(timing.loop === undefined ? {} : { loop: timing.loop }),
    };
  }

  /**
   * The settings given a value, as a patch holds them, leaving out the
   * transitions at the layer's ends; the input's shape names only
   * settings of one layout.
   */
  private definedOf(settings: object): Partial<ShotLayerPlacementSettings> {
    const held = Object.entries(settings).filter(([setting, value]) => value !== undefined && !this.isTransition(setting));
    return Object.fromEntries(held) as Partial<ShotLayerPlacementSettings>;
  }

  private answer(
    ref: string,
    layerId: string,
    layout: LayoutInput | undefined,
    timing: TimingInput | undefined,
    moved: boolean,
    throughAsked: boolean,
  ): OperationResult {
    const shots = this.store.snapshot().shots;
    const placement = shots.placementOf(layerId);
    const layer = shots.findLayer(layerId);
    const video = layer !== null && 'mediaId' in layer && this.contentOf(layer) === 'video' ? layer : null;
    return {
      ok: true,
      output: {
        layer: ref,
        layout: placement,
        ...(video === null ? {} : { timing: this.timingOf(video) }),
        ...(moved ? this.openingOf(ref) : {}),
        ...this.runs.answerOf(layerId, moved || throughAsked),
      },
      problems: [...this.settingsNotKept(ref, layout, placement), ...this.timingKeptInside(ref, timing, video)],
    };
  }

  /** The shot the layer `ref` names opens on now, for an answer. */
  private openingOf(ref: string): { shot: string } | Record<string, never> {
    const resolved = this.shots.resolveLayer(ref);
    return resolved.ok ? { shot: resolved.value.shot.ref } : {};
  }

  /** A warning naming each setting given that the layout does not hold as given. */
  private settingsNotKept(ref: string, layout: LayoutInput | undefined, placement: ShotLayerPlacement): OperationProblem[] {
    if (layout === undefined) return [];
    // A file cropped at its centre holds no position: the centre is where it sits unset.
    const held = { position: placement.fit === 'cover' ? CENTRED : undefined, ...placement } as Readonly<Record<string, unknown>>;
    const notKept = Object.entries(layout)
      .filter(([setting, value]) => setting !== 'kind' && !this.isTransition(setting) && value !== undefined && !this.isSame(held[setting], value))
      .map(([setting]) => setting);
    if (notKept.length === 0) return [];
    return [{
      severity: 'warning',
      message: `Not kept: ${notKept.join(', ')}. backdrop applies only with fit contain, and position only with fit cover.`,
      ref,
    }];
  }

  /** A warning where the stretch given was brought back inside the file. */
  private timingKeptInside(ref: string, timing: TimingInput | undefined, video: ShotFileLayer | null): OperationProblem[] {
    if (timing === undefined || video === null) return [];
    const moved = (timing.inSec !== undefined && !this.isSame(video.inSec, timing.inSec))
      || (timing.outSec !== undefined && !this.isSame(video.outSec, timing.outSec));
    if (!moved) return [];
    const durationSec = this.media.snapshot().get(video.mediaId)?.durationSec ?? null;
    const length = durationSec === null ? '' : ` (the file runs ${this.rounded(durationSec)} s)`;
    const end = video.outSec === null ? 'its end' : `${this.rounded(video.outSec)} s`;
    return [{ severity: 'warning', message: `The stretch was kept inside the file${length}: it plays from ${this.rounded(video.inSec)} s to ${end}.`, ref }];
  }

  private timingOf(video: ShotFileLayer): { inSec: number; outSec: number | null; loop: boolean } {
    return { inSec: this.rounded(video.inSec), outSec: video.outSec === null ? null : this.rounded(video.outSec), loop: video.loop };
  }

  /** Whether `setting` is a transition at one of the layer's ends, which its layout's fields do not hold. */
  private isTransition(setting: string): boolean {
    return (TRANSITION_EDGES as ReadonlyArray<string>).includes(setting);
  }

  private isSame(held: unknown, given: unknown): boolean {
    if (typeof held === 'number' && typeof given === 'number') return Math.abs(held - given) < SAME_VALUE_TOLERANCE;
    if (typeof held === 'object' && held !== null && typeof given === 'object' && given !== null) {
      const heldPosition = held as Readonly<Record<string, unknown>>;
      return Object.entries(given).every(([axis, value]) => this.isSame(heldPosition[axis], value));
    }
    return held === given;
  }

  private missingFile(ref: string): OperationProblem {
    return this.error(`${ref} shows a file the media list no longer holds: it cannot be laid out or timed, only removed with remove_layers.`, ref);
  }

  private rounded(sec: number): number {
    return Math.round(sec * 100) / 100;
  }

  private error(message: string, ref: string): OperationProblem {
    return { severity: 'error', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
