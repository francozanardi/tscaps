import { z } from 'zod';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CustomGraphicPresetReader, CustomGraphicReading } from '@core/editor-operations/services/CustomGraphicPresetReader';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { GraphicFieldsCheck } from '@core/editor-operations/services/GraphicFieldsCheck';
import { GRAPHIC_INPUT_SCHEMAS, type CustomGraphicInput } from '@core/editor-operations/services/GraphicInputSchemas';
import type { GraphicPlaybackCheck } from '@core/editor-operations/services/GraphicPlaybackCheck';
import type { LayerRunWriter } from '@core/editor-operations/services/LayerRunWriter';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';
import type { AddShotGraphicAction } from '@core/shots/actions/AddShotGraphicAction';

const MAX_PRESETS_LISTED = 15;

/**
 * `add_graphic`: puts a graphic on a shot, from the library's presets or
 * written from nothing, with values set on its fields, in one undo step.
 * Answers the new layer, so the caller can play it, edit it or move it.
 */
export class AddGraphicOperation implements EditorOperation {
  readonly name = 'add_graphic';
  readonly effect = 'edit';
  readonly description = [
    'Put a graphic (a small web page drawn in a box over the video, below the captions) on a shot; it shows for that whole shot, or with `through` for every shot from that one through a later one, as one graphic that enters once and leaves once.',
    'Give either `preset`, a ready-made one, with its fields set through `params`; or `graphic`, one written from nothing.',
    'A preset suits what its family says (a hook; a speaker; a call to action; the info family when the person asks for that kind of graphic: a number, a phrase, a contrast, a list item, a section title, a quote, a place); for a key moment of the video, write your own.',
    'Answers the new layer, its field ids and the moments its code declares (add_sounds can put a sound on one), and warns when its code threw or drew nothing. Change it with edit_graphic; move or resize it with set_layer, which also lays out one that paints its whole box over the whole frame or split, as a b-roll.',
  ].join(' ');

  private readonly input = new OperationInput({
    shot: z.string().describe('The shot to put it on, as a ref: shot:<id>. To show it for part of the video, split the shots first.'),
    through: z.string().optional().describe('The last shot it shows on, as a ref: shot:<id>, a shot after `shot`; the video\'s last shot keeps it to the end. Left out, it shows for `shot` alone.'),
    preset: z.string().optional().describe('A ready-made graphic, by its id (list_catalog graphic_presets). Give preset or graphic, not both.'),
    graphic: GRAPHIC_INPUT_SCHEMAS.customGraphic.optional().describe('A graphic written from nothing. Give preset or graphic, not both.'),
    params: GRAPHIC_INPUT_SCHEMAS.params.optional(),
    hidesCaptions: GRAPHIC_INPUT_SCHEMAS.hidesCaptions.optional().describe('Keep the captions off the screen for the shots it shows on. Left out: what the preset says (on for hook presets), off for a graphic written from nothing.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly presets: GraphicPresetCatalog,
    private readonly customPresets: CustomGraphicPresetReader,
    private readonly fieldsCheck: GraphicFieldsCheck,
    private readonly addGraphic: AddShotGraphicAction,
    private readonly playback: GraphicPlaybackCheck,
    private readonly runs: LayerRunWriter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { shot: shotRef, through, preset: presetId, graphic, params = {}, hidesCaptions } = checked.value;
    const reading = this.readingOf(presetId, graphic);
    if (!reading.ok) return this.refused(reading.problems);
    const shot = this.shots.resolveShot(shotRef);
    if (!shot.ok) return this.refused([shot.problem]);
    const throughProblem = through === undefined ? null : this.runs.problemOf(shot.value, through);
    if (throughProblem !== null) return this.refused([throughProblem]);
    const paramProblems = this.fieldsCheck.paramProblems(params, reading.preset.graphic.fields);
    if (paramProblems.length > 0) return this.refused(paramProblems);
    const preset = this.withCaptions(this.withParams(reading.preset, params), hidesCaptions);
    const layerId = this.addGraphic.execute(shot.value.shot.id, preset);
    if (layerId === null) return this.refused([this.error(`Nothing was added: ${shot.value.ref} could not take the graphic.`)]);
    const layerRef = this.parser.formatOf('layer', layerId);
    if (through !== undefined) this.runs.write(layerId, through);
    const played = await this.playback.problemsOf(layerId, layerRef);
    const moments = this.momentsOf(layerRef);
    return {
      ok: true,
      output: {
        layer: layerRef,
        shot: shot.value.ref,
        ...this.runs.answerOf(layerId, through !== undefined),
        ...(presetId === undefined ? {} : { preset: presetId }),
        fields: preset.graphic.fields.map((field) => field.id),
        box: preset.box,
        aspectRatio: preset.graphic.aspectRatio,
        hidesCaptions: preset.graphic.hidesCaptions,
        ...(moments.length === 0 ? {} : { moments }),
      },
      problems: [...reading.warnings, ...played],
    };
  }

  /** The moments the graphic on the layer `layerRef` declared as it played, each with when it happens after the graphic appears. */
  private momentsOf(layerRef: string): Array<{ readonly id: string; readonly sec: number }> {
    const layer = this.shots.resolveLayer(layerRef);
    if (!layer.ok || !('graphic' in layer.value.layer)) return [];
    return layer.value.layer.graphic.moments.map((moment) => ({ id: moment.id, sec: Math.round(moment.sec * 100) / 100 }));
  }

  /** The preset the graphic starts from: the library's one named `presetId`, or the one `graphic` makes; exactly one of them is given. */
  private readingOf(presetId: string | undefined, graphic: CustomGraphicInput | undefined): CustomGraphicReading {
    if (presetId !== undefined && graphic === undefined) return this.presetNamed(presetId);
    if (graphic !== undefined && presetId === undefined) return this.customPresets.read(graphic);
    return { ok: false, problems: [this.error('Give either preset or graphic, one of the two.')] };
  }

  private presetNamed(presetId: string): CustomGraphicReading {
    const preset = this.presets.list().find((candidate) => candidate.id === presetId);
    if (preset !== undefined) return { ok: true, preset, warnings: [] };
    const known = this.presets.list().slice(0, MAX_PRESETS_LISTED).map((candidate) => candidate.id).join(', ');
    return { ok: false, problems: [this.error(`There is no graphic preset "${presetId}"; the presets are ${known} (list_catalog graphic_presets describes them).`)] };
  }

  /** `preset` with `params` set on its graphic's fields, so the graphic arrives with them in the same undo step. */
  private withParams(preset: GraphicPreset, params: Readonly<Record<string, GraphicParamValue>>): GraphicPreset {
    if (Object.keys(params).length === 0) return preset;
    return { ...preset, graphic: { ...preset.graphic, params: { ...preset.graphic.params, ...params } } };
  }

  /** `preset` keeping the captions off its shot or not, as asked; as it is when nothing was asked. */
  private withCaptions(preset: GraphicPreset, hidesCaptions: boolean | undefined): GraphicPreset {
    if (hidesCaptions === undefined || hidesCaptions === preset.graphic.hidesCaptions) return preset;
    return { ...preset, graphic: { ...preset.graphic, hidesCaptions } };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
