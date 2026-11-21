import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { SHEET_ANIMATION_SCOPES } from '@core/elements/domain/ElementAnimationScope';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import type { AnimationPresetCheck } from '@core/editor-operations/services/AnimationPresetCheck';
import type { ReplaceSheetAnimationAction } from '@core/sheets/actions/style/ReplaceSheetAnimationAction';
import type { ResetSheetMotionAction } from '@core/sheets/actions/style/ResetSheetMotionAction';
import type { TuneSheetAnimationAction } from '@core/sheets/actions/style/TuneSheetAnimationAction';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';
import type { TemplateAnimationAnswerResolver } from '@core/templates/services/animations/TemplateAnimationAnswerResolver';
import type { TemplateAnimationField, TemplateAnimationFieldResolver } from '@core/templates/services/animations/TemplateAnimationFieldResolver';

/** The preset value that states "no motion of its own", as opposed to null, which leaves it to the template. */
const NO_MOTION = 'none';

/**
 * Sets how one kind of element moves everywhere a sheet paints, as the
 * Motion tab does: a preset in place of the template's, no motion, the
 * template's own movement tuned, or the kind given back to the template.
 *
 * Mirrors the tab's picks. Asking for the preset the template already
 * plays takes the sheet's own answer back rather than restating it, so
 * the template's values stay, and its fields then tune the template's
 * animation. Asking for no motion where the template moves nothing does
 * the same. Giving the kind back (null) also puts every control the
 * template publishes over that movement back at its preset's value.
 *
 * Edits go to the sheet named, which is made active only for the edit;
 * linked sheets follow, as every sheet style edit does.
 */
export class SheetAnimationWriter {
  constructor(
    private readonly store: EditorStore,
    private readonly activeSheetEdits: ActiveSheetEditRunner,
    private readonly presets: AnimationPresetCheck,
    private readonly support: AnimationSupportResolver,
    private readonly templateAnswers: TemplateAnimationAnswerResolver,
    private readonly templateFields: TemplateAnimationFieldResolver,
    private readonly replaceAnimation: ReplaceSheetAnimationAction,
    private readonly tuneAnimation: TuneSheetAnimationAction,
    private readonly resetMotion: ResetSheetMotionAction,
  ) {}

  /**
   * Gives `scope` of `sheet` (named `ref` in problems and output)
   * `preset`: a preset id, "none", or null for the template's. `params`
   * set the fields of whatever moves the kind after the pick. Nothing
   * is written when any of it is refused.
   */
  write(
    ref: string,
    sheet: Sheet,
    scope: ElementAnimationScope,
    preset: string | null,
    params: Readonly<Record<string, number | string>>,
  ): OperationResult {
    if (!SHEET_ANIMATION_SCOPES.includes(scope)) {
      return this.refused(ref, `A sheet offers the scopes ${SHEET_ANIMATION_SCOPES.join(', ')}; "${scope}" is not one of them.`);
    }
    if (preset === null) {
      this.activeSheetEdits.runOn(sheet.id, () => this.resetMotion.execute(scope));
      return this.written(ref, sheet.id, scope);
    }
    if (!this.support.supports(sheet.template.features.animation, scope, null)) {
      return this.refused(ref, `The template of this sheet (${sheet.template.metadata.name}) offers no animation there: it blends its captions with the video, and an animation would cut the blend.`);
    }
    if (preset === NO_MOTION) return this.stop(ref, sheet, scope);
    if (this.replacedPresetOf(sheet, scope) !== preset && this.templatePresetOf(sheet, scope) === preset) {
      return this.tuneTemplates(ref, sheet, scope, preset, params);
    }
    return this.replace(ref, sheet, scope, preset, params);
  }

  private stop(ref: string, sheet: Sheet, scope: ElementAnimationScope): OperationResult {
    const templateIsStill = this.templatePresetOf(sheet, scope) === null;
    this.activeSheetEdits.runOn(sheet.id, () => {
      if (templateIsStill) this.replaceAnimation.clear(scope);
      else this.replaceAnimation.disable(scope);
    });
    return this.written(ref, sheet.id, scope);
  }

  private replace(
    ref: string,
    sheet: Sheet,
    scope: ElementAnimationScope,
    presetId: string,
    params: Readonly<Record<string, number | string>>,
  ): OperationResult {
    const picked = this.presets.fitting(ref, presetId, null, scope);
    if (!picked.ok) return { ok: false, output: null, problems: [picked.problem] };
    const fields = this.presets.params(ref, picked.preset.id, picked.preset.controls, params);
    if (!fields.ok) return { ok: false, output: null, problems: fields.problems };
    this.activeSheetEdits.runOn(sheet.id, () => {
      this.replaceAnimation.apply(scope, picked.preset.id);
      for (const [control, value] of fields.value) this.replaceAnimation.setControl(scope, control, value);
    });
    return this.written(ref, sheet.id, scope);
  }

  /** Takes the sheet's own answer back, then moves the fields asked for inside the template's animation. */
  private tuneTemplates(
    ref: string,
    sheet: Sheet,
    scope: ElementAnimationScope,
    presetId: string,
    params: Readonly<Record<string, number | string>>,
  ): OperationResult {
    const offered = this.templateFieldsOf(sheet, scope).map((field) => field.control);
    const fields = this.presets.params(ref, presetId, offered, params);
    if (!fields.ok) return { ok: false, output: null, problems: fields.problems };
    this.activeSheetEdits.runOn(sheet.id, () => {
      this.replaceAnimation.clear(scope);
      for (const [control, value] of fields.value) {
        // Read again for each field: a move changes what its property holds, and the next one on it composes over that.
        const now = this.store.sheet(sheet.id);
        const standing = now === null ? undefined : this.templateFieldsOf(now, scope).find((field) => field.control.id === control.id)?.standing;
        if (standing !== undefined) this.tuneAnimation.setField(scope, control, value, standing);
      }
    });
    return this.written(ref, sheet.id, scope);
  }

  /** The dials the template offers over its own movement of `scope`, at the values the sheet tuned them to. */
  private templateFieldsOf(sheet: Sheet, scope: ElementAnimationScope): ReadonlyArray<TemplateAnimationField> {
    const held = sheet.animations.get(scope);
    return this.templateFields.fieldsFor(sheet.template.declaredAnimations, scope, held?.kind === 'tuned' ? held.values : {});
  }

  /** The preset the sheet put in place of the template's for `scope`, "none" for no motion, or undefined when the template decides. */
  private replacedPresetOf(sheet: Sheet, scope: ElementAnimationScope): string | undefined {
    const held = sheet.animations.get(scope);
    return held?.kind === 'replaced' ? held.animation.presetId ?? NO_MOTION : undefined;
  }

  /** The library preset the template itself plays for `scope`, null when it moves nothing there, undefined when no preset names what it does. */
  private templatePresetOf(sheet: Sheet, scope: ElementAnimationScope): string | null | undefined {
    const answer = this.templateAnswers.answerFor(sheet.template.declaredAnimations, scope);
    if (answer.kind === 'named') return answer.presetId;
    return answer.kind === 'still' ? null : undefined;
  }

  /**
   * What moves `scope` of the sheet now: the sheet's own preset with its
   * fields, or, marked `byTemplate`, the preset the template plays
   * ("template" when none names it) with the fields it was tuned to.
   */
  private written(ref: string, sheetId: string, scope: ElementAnimationScope): OperationResult {
    const sheet = this.store.sheet(sheetId);
    if (sheet === null) return { ok: true, output: { element: ref, scope }, problems: [] };
    const held = sheet.animations.get(scope);
    if (held?.kind === 'replaced') {
      return { ok: true, output: { element: ref, scope, preset: held.animation.presetId ?? NO_MOTION, params: held.animation.params }, problems: [] };
    }
    const plays = this.templatePresetOf(sheet, scope);
    const tuned = held?.kind === 'tuned'
      ? Object.fromEntries(this.templateFieldsOf(sheet, scope).map((field) => [field.control.id, field.control.defaultValue]))
      : {};
    return { ok: true, output: { element: ref, scope, preset: plays === undefined ? 'template' : plays ?? NO_MOTION, byTemplate: true, params: tuned }, problems: [] };
  }

  private refused(ref: string, message: string): OperationResult {
    const problem: OperationProblem = { severity: 'error', message, ref };
    return { ok: false, output: null, problems: [problem] };
  }
}
