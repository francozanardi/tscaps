import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ANIMATED_KIND_BY_SCOPE, type ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

const LISTED_AT_MOST = 15;

/** A preset asked for: the library's preset, or the problem to answer with. */
export type CheckedPreset =
  | { readonly ok: true; readonly preset: ElementAnimationPreset }
  | { readonly ok: false; readonly problem: OperationProblem };

/** Fields asked for: each with the control it sets, or every problem found. */
export type CheckedAnimationParams =
  | { readonly ok: true; readonly value: ReadonlyArray<readonly [ElementControl, ElementControlValue]> }
  | { readonly ok: false; readonly problems: ReadonlyArray<OperationProblem> };

/**
 * Checks an animation a caller asks for against the library: that the
 * preset fits the part it would move and the clock it would run on, and
 * that every field value is one of its fields, in range. Each problem
 * names `ref`, the element asked about, and lists what would fit.
 */
export class AnimationPresetCheck {
  constructor(
    private readonly animations: ElementAnimationCatalog,
    private readonly timing: ElementTimingVariableResolver,
  ) {}

  /**
   * The preset `presetId`, when it fits `scope` on an element of kind
   * `owner`; `owner` is null for a sheet, whose every scope names the
   * kind it moves.
   */
  fitting(ref: string, presetId: string, owner: ElementKind | null, scope: ElementAnimationScope): CheckedPreset {
    const animatedKind = ANIMATED_KIND_BY_SCOPE[scope] ?? owner;
    if (animatedKind === null) return { ok: false, problem: this.problem(ref, `"${scope}" names no part to animate.`) };
    const fitting = this.animations.forClock(animatedKind, this.timing.resolve(animatedKind, scope));
    const preset = fitting.find((candidate) => candidate.id === presetId);
    if (preset !== undefined) return { ok: true, preset };
    const where = owner === null ? `the ${scope} of a sheet` : `a ${owner}'s ${scope} animation`;
    const reason = this.animations.byId(presetId) === null ? 'is not an animation preset' : `does not fit ${where}`;
    return { ok: false, problem: this.problem(ref, `"${presetId}" ${reason}. Presets that fit: ${this.listed(fitting.map((each) => each.id))}.`) };
  }

  /** `params` checked against `controls`, the fields `animationId` offers. */
  params(
    ref: string,
    animationId: string,
    controls: ReadonlyArray<ElementControl>,
    params: Readonly<Record<string, number | string>>,
  ): CheckedAnimationParams {
    const accepted: Array<readonly [ElementControl, ElementControlValue]> = [];
    const problems: OperationProblem[] = [];
    for (const [fieldId, value] of Object.entries(params)) {
      const control = controls.find((candidate) => candidate.id === fieldId);
      if (control === undefined) {
        const fields = controls.map((each) => this.fieldSummary(each)).join(', ') || 'none';
        problems.push(this.problem(ref, `"${fieldId}" is not a field of ${animationId}. Its fields: ${fields}.`));
        continue;
      }
      const wrong = this.valueProblem(control, value);
      if (wrong === null) accepted.push([control, value]);
      else problems.push(this.problem(ref, `${animationId} field ${wrong}`));
    }
    return problems.length > 0 ? { ok: false, problems } : { ok: true, value: accepted };
  }

  /** What is wrong with `value` for `control`, starting with the field's id; null when it fits. */
  private valueProblem(control: ElementControl, value: number | string): string | null {
    if (control.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${this.fieldSummary(control)} takes a number.`;
      const outOfRange = (control.min !== undefined && value < control.min) || (control.max !== undefined && value > control.max);
      return outOfRange ? `${this.fieldSummary(control)} does not take ${value}.` : null;
    }
    if (control.type === 'select' || control.type === 'toggle') {
      const fits = typeof value === 'string' && (control.options ?? []).some((option) => option.value === value);
      return fits ? null : `${this.fieldSummary(control)} does not take ${JSON.stringify(value)}.`;
    }
    if (control.type === 'color') return typeof value === 'string' ? null : `${control.id} takes a colour as text.`;
    return `${control.id} cannot be set here.`;
  }

  /** A field as a caller reads it: its id, then its range and unit, or its options. */
  private fieldSummary(control: ElementControl): string {
    if (control.type === 'number') {
      const unit = control.unit === undefined ? '' : ` ${control.unit}`;
      return `${control.id} (${control.min ?? '-∞'} to ${control.max ?? '∞'}${unit})`;
    }
    if (control.options !== undefined) return `${control.id} (${control.options.map((option) => option.value).join(' | ')})`;
    return `${control.id} (${control.type})`;
  }

  private listed(ids: ReadonlyArray<string>): string {
    if (ids.length === 0) return 'none';
    const shown = ids.slice(0, LISTED_AT_MOST).join(', ');
    return ids.length > LISTED_AT_MOST ? `${shown}, … (list_catalog for all)` : shown;
  }

  private problem(ref: string, message: string): OperationProblem {
    return { severity: 'error', message, ref };
  }
}
