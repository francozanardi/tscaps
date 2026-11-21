import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetElementAnimationAction } from '@core/elements/actions/SetElementAnimationAction';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ANIMATED_KIND_BY_SCOPE, ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { AnimationPresetCheck } from '@core/editor-operations/services/AnimationPresetCheck';
import type { CaptionElement, CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetAnimationWriter } from '@core/editor-operations/services/SheetAnimationWriter';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SetShotLayerAnimationAction } from '@core/shots/actions/SetShotLayerAnimationAction';
import type { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';

const SCOPES = ['self', 'segments', 'words', 'emojis', 'entrance', 'exit', 'segments-exit', 'words-exit', 'emojis-exit', 'camera'] as const;
type ScopeName = typeof SCOPES[number];

const SCOPE_BY_NAME: Readonly<Record<ScopeName, ElementAnimationScope>> = {
  self: ElementAnimationScope.SELF,
  segments: ElementAnimationScope.SEGMENTS,
  words: ElementAnimationScope.WORDS,
  emojis: ElementAnimationScope.EMOJIS,
  entrance: ElementAnimationScope.ENTRANCE,
  exit: ElementAnimationScope.EXIT,
  'segments-exit': ElementAnimationScope.SEGMENTS_EXIT,
  'words-exit': ElementAnimationScope.WORDS_EXIT,
  'emojis-exit': ElementAnimationScope.EMOJIS_EXIT,
  camera: ElementAnimationScope.CAMERA,
};

/** The preset value that states "no motion of its own", as opposed to null, which leaves it to the template. */
const NO_MOTION = 'none';

/**
 * `set_element_animation`: gives one part of an element an animation
 * from the library, tunes its fields, or takes it back — a caption
 * segment, line, word or emoji through the element's own record, a
 * shot layer's entrance or exit through the layer's, and one kind of
 * element under a sheet through the sheet's, as its Motion tab does.
 *
 * Refuses a part whose generated block was rewritten by hand in the
 * element's CSS, since the library has stopped deciding there; a scope
 * the element does not offer; a preset that does not fit the element
 * and scope; a field value out of its range; and an animation on a
 * caption whose template offers none there.
 */
export class SetElementAnimationOperation implements EditorOperation {
  readonly name = 'set_element_animation';
  readonly effect = 'edit';
  readonly description = [
    'Give one part of an element an animation preset from the library, tune the preset\'s fields, or take the animation away.',
    'Works on caption elements (segment, line, word, decoration = emoji) and on shot layers; `scope` says which part moves and on whose clock.',
    'Picking a different preset starts its fields at the preset\'s defaults; picking the one already there keeps them, so send the same preset with `params` to tune it.',
    'Refused where the element\'s CSS rewrote that animation by hand: then edit it with set_element_css. A shot\'s camera moves are set_camera\'s.',
    'A sheet ref (sheet:<id>) animates all its captions, replacing their own.',
  ].join(' ');

  private readonly input = new OperationInput({
    element: z.string().describe('The element, as a ref: segment:<id>, line:<id>, word:<id>, decoration:<id> (an emoji) or layer:<id>.'),
    scope: z.enum(SCOPES).describe([
      'Which part moves.',
      'self: the caption element itself, on its own clock (a scene as it appears, a line as it starts being spoken, a word as it is spoken, an emoji with its word).',
      'words: every word of a scene or line, each as it is spoken, so they arrive one after another; it drops the words\' own self animations.',
      'emojis: every emoji of a scene, each with its word; it drops their own self animations.',
      'entrance / exit: a layer as it comes on screen / as it leaves.',
      'A segment offers self, words and emojis; a line self and words; a word or an emoji self; a layer entrance and exit.',
      'A sheet: segments, words, emojis and their -exit forms.',
    ].join(' ')),
    preset: z.string().nullable().describe(`A preset id that fits the element and scope (list_catalog lists them), "${NO_MOTION}" for no motion of its own whatever the template does, or null to go back to what the template does. On a layer, null and "${NO_MOTION}" both remove the animation.`),
    params: z.record(z.string(), z.union([z.number(), z.string()])).optional()
      .describe('The preset\'s fields to set, by field id: numbers within the field\'s range and unit, choices by option value. Fields left out keep their value. Needs a preset.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly shots: ShotRefResolver,
    private readonly scenes: CaptionSceneLocator,
    private readonly store: EditorStore,
    private readonly sheets: SheetRefResolver,
    private readonly styledElements: StyledElementCatalog,
    private readonly presets: AnimationPresetCheck,
    private readonly animationCssWriter: ElementAnimationCssWriter,
    private readonly animationSupport: AnimationSupportResolver,
    private readonly setElementAnimation: SetElementAnimationAction,
    private readonly setShotLayerAnimation: SetShotLayerAnimationAction,
    private readonly sheetAnimations: SheetAnimationWriter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { element, preset, params = {} } = checked.value;
    const scope = SCOPE_BY_NAME[checked.value.scope];
    if (scope === ElementAnimationScope.CAMERA) {
      return this.refused([this.problem(element, 'A shot\'s camera move is not an element animation: use set_camera.')]);
    }
    if (preset === null || preset === NO_MOTION) {
      if (Object.keys(params).length > 0) {
        return this.refused([this.problem(element, 'params tune a preset: give `preset` a preset id to set them.')]);
      }
    }
    if (element.startsWith('shot:')) {
      return this.refused([this.problem(element, 'A shot\'s own video has no entrance or exit; its camera moves are set with set_camera.')]);
    }
    if (element.startsWith('layer:')) return this.animateLayer(element, scope, preset, params);
    if (element.startsWith('sheet:')) return this.animateSheet(element, scope, preset, params);
    return this.animateCaption(element, scope, preset, params);
  }

  private animateSheet(
    ref: string,
    scope: ElementAnimationScope,
    preset: string | null,
    params: Readonly<Record<string, number | string>>,
  ): OperationResult {
    const resolved = this.sheets.resolve(ref);
    if (!resolved.ok) return this.refused([resolved.problem]);
    return this.sheetAnimations.write(ref, resolved.value, scope, preset, params);
  }

  private animateCaption(
    ref: string,
    scope: ElementAnimationScope,
    preset: string | null,
    params: Readonly<Record<string, number | string>>,
  ): OperationResult {
    const resolved = this.captions.resolve(ref);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const element = resolved.value;
    const offered = this.styledElements.animationScopesFor(element.kind);
    if (!offered.includes(scope)) {
      return this.refused([this.problem(ref, `A ${element.kind} offers the scopes ${offered.join(', ')}; "${scope}" is not one of them.`)]);
    }
    const style = this.store.snapshot().elementStyles.get(element.id);
    const takenOver = this.takenOverProblem(ref, style?.css ?? '', element.kind, scope, style?.animations?.[scope]);
    if (takenOver !== null) return this.refused([takenOver]);
    if (preset === null) {
      this.setElementAnimation.clear(element.id, element.kind, scope);
      return this.written(ref, scope, this.store.snapshot().elementStyles.animationOf(element.id, scope));
    }
    const unsupported = this.unsupportedByTemplate(element, scope);
    if (unsupported !== null) return this.refused([unsupported]);
    if (preset === NO_MOTION) {
      this.setElementAnimation.disable(element.id, element.kind, scope);
      return this.written(ref, scope, this.store.snapshot().elementStyles.animationOf(element.id, scope));
    }
    const picked = this.presets.fitting(ref, preset, element.kind, scope);
    if (!picked.ok) return this.refused([picked.problem]);
    const fields = this.presets.params(ref, picked.preset.id, picked.preset.controls, params);
    if (!fields.ok) return this.refused(fields.problems);
    this.setElementAnimation.apply(element.id, element.kind, scope, picked.preset.id);
    for (const [control, value] of fields.value) {
      this.setElementAnimation.setControl(element.id, element.kind, scope, control, value);
    }
    return this.written(ref, scope, this.store.snapshot().elementStyles.animationOf(element.id, scope));
  }

  private animateLayer(
    ref: string,
    scope: ElementAnimationScope,
    preset: string | null,
    params: Readonly<Record<string, number | string>>,
  ): OperationResult {
    const resolved = this.shots.resolveLayer(ref);
    if (!resolved.ok) return this.refused([resolved.problem]);
    if (scope !== ElementAnimationScope.ENTRANCE && scope !== ElementAnimationScope.EXIT) {
      return this.refused([this.problem(ref, `A layer offers the scopes entrance and exit; "${scope}" is not one of them.`)]);
    }
    const layerId = resolved.value.layer.id;
    const style = this.store.snapshot().shots.layerStyles.get(layerId);
    const takenOver = this.takenOverProblem(ref, style?.css ?? '', 'layer', scope, style?.animations?.[scope]);
    if (takenOver !== null) return this.refused([takenOver]);
    if (preset === null || preset === NO_MOTION) {
      this.setShotLayerAnimation.pick([layerId], scope, null);
      return this.written(ref, scope, this.store.snapshot().shots.layerStyles.animationOf(layerId, scope));
    }
    const picked = this.presets.fitting(ref, preset, 'layer', scope);
    if (!picked.ok) return this.refused([picked.problem]);
    const fields = this.presets.params(ref, picked.preset.id, picked.preset.controls, params);
    if (!fields.ok) return this.refused(fields.problems);
    this.setShotLayerAnimation.pick([layerId], scope, picked.preset.id);
    for (const [control, value] of fields.value) {
      this.setShotLayerAnimation.setParam([layerId], scope, control.id, value);
    }
    return this.written(ref, scope, this.store.snapshot().shots.layerStyles.animationOf(layerId, scope));
  }

  /** The refusal for a part whose block is no longer the one its record would write, or null while the library still decides it. */
  private takenOverProblem(
    ref: string,
    css: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    current: ElementAnimation | undefined,
  ): OperationProblem | null {
    if (current === undefined || !this.animationCssWriter.isTakenOver(css, kind, scope, current)) return null;
    return this.problem(
      ref,
      `The ${scope} animation of ${ref} was rewritten by hand in its CSS, so presets no longer apply there. Edit it with set_element_css${kind === 'layer' ? '' : ', or clear_element_style to drop everything the element was given and start again'}.`,
    );
  }

  /** The refusal for an animation the caption's template cannot take where it would land, or null when it can. */
  private unsupportedByTemplate(element: CaptionElement, scope: ElementAnimationScope): OperationProblem | null {
    const document = this.store.snapshot().document;
    const scene = document === null ? null : this.scenes.sceneOf(document, element.kind, element.id);
    const sheet = scene === null ? null : this.store.sheet(scene.sheetId);
    if (sheet === null) return null;
    if (this.animationSupport.supports(sheet.template.features.animation, scope, element.kind)) return null;
    const landsOn = ANIMATED_KIND_BY_SCOPE[scope] ?? element.kind;
    return this.problem(
      element.ref,
      `The template of this caption (${sheet.template.metadata.name}) offers no animation on its ${landsOn}s: it blends its captions with the video, and an animation there would cut the blend.`,
    );
  }

  private written(element: string, scope: ElementAnimationScope, animation: ElementAnimation | null): OperationResult {
    const preset = animation === null ? null : animation.presetId ?? NO_MOTION;
    return { ok: true, output: { element, scope, preset, params: animation?.params ?? {} }, problems: [] };
  }

  private problem(ref: string, message: string): OperationProblem {
    return { severity: 'error', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
