import { z } from 'zod';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { GraphicDocumentCheck, GraphicDocumentParts } from '@core/editor-operations/services/GraphicDocumentCheck';
import type { GraphicFieldsCheck } from '@core/editor-operations/services/GraphicFieldsCheck';
import { GRAPHIC_INPUT_SCHEMAS } from '@core/editor-operations/services/GraphicInputSchemas';
import type { GraphicPlaybackCheck } from '@core/editor-operations/services/GraphicPlaybackCheck';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicBox } from '@core/graphics/domain/GraphicBox';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicField } from '@core/graphics/domain/GraphicField';
import type { GraphicPresetAnimation } from '@core/graphics/domain/GraphicPresetMotion';
import type { GraphicPresetSound } from '@core/graphics/domain/GraphicPresetSound';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';
import type { SetShotGraphicAction } from '@core/shots/actions/SetShotGraphicAction';
import type { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

const DOCUMENT_PARTS: ReadonlyArray<keyof GraphicDocument> = ['html', 'css', 'js'];
const REDECLARED_PRESET_ID = 'custom';
const REDECLARED_PRESET_NAME = 'Custom';

/** What a change asks of the graphic, the parts it leaves out holding what the graphic holds. */
interface GraphicChange {
  readonly parts: GraphicDocumentParts;
  readonly params: Readonly<Record<string, GraphicParamValue>>;
  readonly fields: ReadonlyArray<GraphicField> | undefined;
  readonly aspectRatio: number | undefined;
}

/**
 * `edit_graphic`: changes a graphic layer's code, the values on its
 * fields, its fields or its shape, keeping everything else the layer has.
 *
 * Code and values are written as the Code and Content tabs write them.
 * Fields and shape have no edit of their own: the graphic is put back on
 * its layer the way a preset is picked, as a preset holding its new
 * graphic and the layer's own box, motion and moment sounds, so picking
 * it changes nothing else; a layout a preset's box cannot hold is laid
 * out again after, and a moment sound a preset cannot carry is named in
 * a warning.
 */
export class EditGraphicOperation implements EditorOperation {
  readonly name = 'edit_graphic';
  readonly effect = 'edit';
  readonly description = [
    'Change a graphic layer: replace parts of its code (html, css or js, each replaced whole), set values on its fields (params), redeclare its fields or its aspectRatio, or keep the captions off its shot or show them again (hidesCaptions). Give only what changes.',
    'Values on fields that keep their id and kind survive a change of fields; its box, motion and sounds stay as they are.',
    'Read it first with get_element (its code, fields and last errors). Warns when its code threw or drew nothing. Move or resize its box with set_layer.',
  ].join(' ');

  private readonly input = new OperationInput({
    layer: z.string().describe('The graphic layer, as a ref: layer:<id>.'),
    html: GRAPHIC_INPUT_SCHEMAS.html.optional(),
    css: GRAPHIC_INPUT_SCHEMAS.css.optional(),
    js: GRAPHIC_INPUT_SCHEMAS.js.optional(),
    params: GRAPHIC_INPUT_SCHEMAS.params.optional(),
    fields: GRAPHIC_INPUT_SCHEMAS.fields.optional()
      .describe('The whole new list of fields, in place of the old one.'),
    aspectRatio: GRAPHIC_INPUT_SCHEMAS.aspectRatio.optional(),
    hidesCaptions: GRAPHIC_INPUT_SCHEMAS.hidesCaptions.optional(),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly fieldsCheck: GraphicFieldsCheck,
    private readonly documentCheck: GraphicDocumentCheck,
    private readonly setGraphic: SetShotGraphicAction,
    private readonly setPlacement: SetShotLayerPlacementAction,
    private readonly playback: GraphicPlaybackCheck,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { layer: ref, params = {}, fields, aspectRatio, hidesCaptions, ...parts } = checked.value;
    const change: GraphicChange = { parts, params, fields, aspectRatio };
    if (this.asksNothing(change) && hidesCaptions === undefined) {
      return this.refused([this.error('Give at least one of html, css, js, params, fields, aspectRatio or hidesCaptions.', ref)]);
    }
    const resolved = this.shots.resolveLayer(ref);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const { layer } = resolved.value;
    if (!('graphic' in layer)) {
      return this.refused([this.error(`${ref} shows a file, not a graphic; change a file layer with set_layer or set_element_css.`, ref)]);
    }
    const problems = this.problemsOf(layer.graphic, change).map((problem) => ({ ...problem, ref }));
    const errors = problems.filter((problem) => problem.severity === 'error');
    if (errors.length > 0) return this.refused(errors);
    const changed = this.changedOf(layer.graphic, change);
    const redeclares = changed.includes('fields') || changed.includes('aspectRatio');
    const losses = changed.length === 0 ? [] : redeclares ? this.redeclared(layer, change) : this.edited(layer, change);
    const captionsChanged = hidesCaptions !== undefined && hidesCaptions !== layer.graphic.hidesCaptions;
    if (captionsChanged) this.setGraphic.setHidesCaptions(layer.id, hidesCaptions);
    const graphic = this.graphicOf(layer.id) ?? layer.graphic;
    const played = changed.length === 0 ? [] : await this.playback.problemsOf(layer.id, ref);
    return {
      ok: true,
      output: {
        layer: ref,
        changed: captionsChanged ? [...changed, 'hidesCaptions'] : changed,
        fields: graphic.fields.map((field) => field.id),
        aspectRatio: graphic.aspectRatio,
        hidesCaptions: graphic.hidesCaptions,
      },
      problems: [...problems, ...losses.map((problem) => ({ ...problem, ref })), ...played],
    };
  }

  private asksNothing(change: GraphicChange): boolean {
    return DOCUMENT_PARTS.every((part) => change.parts[part] === undefined)
      && Object.keys(change.params).length === 0
      && change.fields === undefined
      && change.aspectRatio === undefined;
  }

  /**
   * What is wrong with `change` on `graphic`: the fields it declares, the
   * values it sets against the fields the graphic will have, and the code
   * that will run, read against those fields.
   */
  private problemsOf(graphic: Graphic, change: GraphicChange): OperationProblem[] {
    const fields = change.fields ?? graphic.fields;
    // New fields can leave the code reading one no longer declared, so the code that will run is read again.
    const js = change.parts.js ?? (change.fields === undefined ? undefined : graphic.document.js);
    return [
      ...(change.fields === undefined ? [] : this.fieldsCheck.fieldProblems(change.fields)),
      ...this.fieldsCheck.paramProblems(change.params, fields),
      ...this.documentCheck.check({ ...change.parts, js }, fields),
    ];
  }

  /** What `change` would make different on `graphic`: each part of the code, `params.<id>`, `fields`, `aspectRatio`. */
  private changedOf(graphic: Graphic, change: GraphicChange): string[] {
    const fields = change.fields ?? graphic.fields;
    return [
      ...DOCUMENT_PARTS.filter((part) => change.parts[part] !== undefined && change.parts[part] !== graphic.document[part]),
      ...Object.entries(change.params)
        .filter(([fieldId, value]) => (graphic.params[fieldId] ?? fields.find((field) => field.id === fieldId)?.defaultValue) !== value)
        .map(([fieldId]) => `params.${fieldId}`),
      ...(change.fields !== undefined && JSON.stringify(change.fields) !== JSON.stringify(graphic.fields) ? ['fields'] : []),
      ...(change.aspectRatio !== undefined && change.aspectRatio !== graphic.aspectRatio ? ['aspectRatio'] : []),
    ];
  }

  /** Writes the code and values of `change`, as the Code and Content tabs write them; nothing else of the layer moves. */
  private edited(layer: ShotGraphicLayer, change: GraphicChange): OperationProblem[] {
    for (const part of DOCUMENT_PARTS) {
      const text = change.parts[part];
      if (text !== undefined) this.setGraphic.setDocument(layer.id, part, text);
    }
    for (const [fieldId, value] of Object.entries(change.params)) this.setGraphic.setParam(layer.id, fieldId, value);
    return [];
  }

  /**
   * Puts the graphic `change` makes on the layer the way a preset is
   * picked, the preset holding the layer's own box, motion and moment
   * sounds; lays the layer out again where its layout is one a preset's
   * box cannot hold. Answers what could not be kept.
   */
  private redeclared(layer: ShotGraphicLayer, change: GraphicChange): OperationProblem[] {
    const state = this.store.snapshot();
    const placement = state.shots.placementOf(layer.id);
    const momentSounds = this.momentSoundsOf(state.audio.clips(), layer.id);
    const { graphic, droppedParams } = this.graphicAfter(layer.graphic, change);
    this.setGraphic.applyPreset(layer.id, {
      id: REDECLARED_PRESET_ID,
      name: REDECLARED_PRESET_NAME,
      description: '',
      category: null,
      graphic,
      box: this.boxOf(placement),
      motion: { entrance: this.motionOf(layer.id, ElementAnimationScope.ENTRANCE), exit: this.motionOf(layer.id, ElementAnimationScope.EXIT) },
      sounds: momentSounds.flatMap((clip) => this.presetSoundOf(clip)),
      style: null,
    });
    return [
      ...this.droppedParamsWarning(droppedParams),
      ...this.keepPlacement(layer.id, placement),
      ...this.momentSoundWarnings(layer.id, momentSounds),
    ];
  }

  /** The graphic `change` makes of `current`: values kept on the fields that still read them, moments kept until the code runs again. */
  private graphicAfter(current: Graphic, change: GraphicChange): { graphic: Graphic; droppedParams: string[] } {
    const fields = change.fields ?? current.fields;
    const kept = Object.entries(current.params).filter(([fieldId, value]) => {
      const field = fields.find((candidate) => candidate.id === fieldId);
      return field !== undefined && this.fieldsCheck.holds(field, value);
    });
    const graphic: Graphic = {
      document: {
        html: change.parts.html ?? current.document.html,
        css: change.parts.css ?? current.document.css,
        js: change.parts.js ?? current.document.js,
      },
      fields,
      params: { ...Object.fromEntries(kept), ...change.params },
      aspectRatio: change.aspectRatio ?? current.aspectRatio,
      moments: current.moments,
      presetId: current.presetId,
      hidesCaptions: current.hidesCaptions,
    };
    const droppedParams = Object.keys(current.params).filter((fieldId) => !kept.some(([keptId]) => keptId === fieldId));
    return { graphic, droppedParams };
  }

  /** The box a preset would give the layer for `placement`: its own box where it floats in one, the whole frame otherwise. */
  private boxOf(placement: ShotLayerPlacement): GraphicBox {
    if (placement.kind !== 'inset') return { kind: 'full' };
    return { kind: 'box', centerX: placement.centerX, centerY: placement.centerY, width: placement.width };
  }

  private motionOf(layerId: string, scope: ElementAnimationScope.ENTRANCE | ElementAnimationScope.EXIT): GraphicPresetAnimation | null {
    const animation: ElementAnimation | null = this.store.snapshot().shots.layerStyles.animationOf(layerId, scope);
    return animation === null || animation.presetId === null ? null : { presetId: animation.presetId, params: animation.params };
  }

  private momentSoundsOf(clips: ReadonlyArray<AudioClip>, layerId: string): AudioClip[] {
    return clips.filter(({ start: { anchor } }) => anchor.kind === 'layer-moment' && anchor.layerId === layerId);
  }

  /** `clip` as a sound a preset brings on a moment; nothing for one playing a file of the person's, which a preset cannot bring. */
  private presetSoundOf(clip: AudioClip): GraphicPresetSound[] {
    const { anchor } = clip.start;
    if (anchor.kind !== 'layer-moment' || clip.source.kind !== 'builtin') return [];
    return [{ spot: { kind: 'moment', momentId: anchor.momentId }, soundId: clip.source.soundId, volume: clip.volume, offsetSec: clip.start.offsetSec }];
  }

  /** Lays the layer out as `before` again where putting the graphic back moved it; a warning where that lays out a split anew. */
  private keepPlacement(layerId: string, before: ShotLayerPlacement): OperationProblem[] {
    if (JSON.stringify(this.store.snapshot().shots.placementOf(layerId)) === JSON.stringify(before)) return [];
    this.setPlacement.execute(layerId, before);
    if (before.kind !== 'split') return [];
    return [this.warning('Its split layout was laid out again, so the sounds on its split\'s transitions were replaced by the suggested ones.')];
  }

  /** Warnings for the moment sounds that came back other than they were, and the refs all of them have now. */
  private momentSoundWarnings(layerId: string, before: ReadonlyArray<AudioClip>): OperationProblem[] {
    if (before.length === 0) return [];
    const after = this.momentSoundsOf(this.store.snapshot().audio.clips(), layerId);
    const afterShapes = new Set(after.map((clip) => this.shapeOf(clip)));
    const notKept = before.filter((clip) => !afterShapes.has(this.shapeOf(clip)));
    const removed = notKept.filter((clip) => clip.source.kind !== 'builtin');
    const reset = notKept.filter((clip) => clip.source.kind === 'builtin');
    return [
      ...(removed.length === 0 ? [] : [this.warning(`Removed the sounds of files on its moments, which could not be kept: ${this.soundRefs(removed)}; place them again with add_sounds`)]),
      ...(reset.length === 0 ? [] : [this.warning(`Placed again with their sound and volume only, other settings reset: ${this.soundRefs(reset)}`)]),
      ...(after.length === 0 ? [] : [this.warning(`The sounds on its moments were placed again under new refs: ${this.soundRefs(after)}`)]),
    ];
  }

  private droppedParamsWarning(fieldIds: ReadonlyArray<string>): OperationProblem[] {
    if (fieldIds.length === 0) return [];
    return [this.warning(`Values dropped, their field gone or of another kind now: ${fieldIds.join(', ')}.`)];
  }

  /** What a clip plays and how, whatever its id. */
  private shapeOf(clip: AudioClip): string {
    const { id: _id, ...shape } = clip;
    return JSON.stringify(shape);
  }

  private soundRefs(clips: ReadonlyArray<AudioClip>): string {
    return clips.map((clip) => this.parser.formatOf('sound', clip.id)).join(', ');
  }

  private graphicOf(layerId: string): Graphic | null {
    const layer = this.store.snapshot().shots.findLayer(layerId);
    return layer !== null && 'graphic' in layer ? layer.graphic : null;
  }

  private warning(message: string): OperationProblem {
    return { severity: 'warning', message };
  }

  private error(message: string, ref: string): OperationProblem {
    return { severity: 'error', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
