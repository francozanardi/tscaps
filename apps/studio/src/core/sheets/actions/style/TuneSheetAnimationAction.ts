import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import type { AnimationValueComposer } from '@core/elements/services/css/AnimationValueComposer';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { TunedPropertyValues } from '@core/sheets/domain/SheetAnimation';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Moves a value inside the animation the active sheet's template
 * already applies to one kind of element.
 *
 * The animation itself is untouched — the template's rule still
 * declares it, and this only re-answers the custom properties that
 * rule reads, from a layer that arrives later. Which is what lets it
 * reach a rule addressed by a selector nothing here knows.
 *
 * Only where the template is what is moving that kind. A sheet that
 * replaced the animation is not tuning the template's any more, and a
 * kind holds one answer, so there is nothing here to move.
 *
 * A sheet's answer belongs to its link group the way every other style
 * edit does: linked siblings render alike or the link means nothing.
 */
export class TuneSheetAnimationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly animationCssBuilder: ElementAnimationCssBuilder,
    private readonly valueComposer: AnimationValueComposer,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  /**
   * `standing` is what the property holds before the move, which the
   * caller reads off the field it is drawing — the sheet's own value
   * where it has one, and the template's where it does not.
   */
  setField(
    scope: ElementAnimationScope,
    control: AuthoredElementControl,
    value: ElementControlValue,
    standing: TunedPropertyValues[string],
  ): void {
    const active = this.store.activeSheet();
    if (!active) return;
    if (active.animations.get(scope)?.kind === 'replaced') return;

    const values = { ...this.tunedFor(scope), [control.property]: this.valueComposer.compose(standing, control, value) };
    const css = this.animationCssBuilder.buildTunedForEveryElement(values, scope);
    const animations = active.animations.with(scope, css === '' ? undefined : { kind: 'tuned', values, css });
    if (animations === active.animations) return;

    this.store.commit('Change motion', `sheetAnimationTuning:${active.id}:${scope}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(active.with({ animations }), this.store.snapshot().sheets) });
  }

  /** Leaves the kind moving at the values its template wrote. */
  clear(scope: ElementAnimationScope): void {
    const active = this.store.activeSheet();
    if (!active || active.animations.get(scope)?.kind !== 'tuned') return;
    this.store.commit('Change motion', `sheetAnimationTuning:${active.id}:${scope}`);
    this.store.patch({
      sheets: this.linkedSheetsSync.applyStyleEdit(
        active.with({ animations: active.animations.with(scope, undefined) }),
        this.store.snapshot().sheets,
      ),
    });
  }

  private tunedFor(scope: ElementAnimationScope): TunedPropertyValues {
    const held = this.store.activeSheet()?.animations.get(scope);
    return held?.kind === 'tuned' ? held.values : {};
  }
}
