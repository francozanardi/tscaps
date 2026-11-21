import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import { MOTION_SUBGROUP_BY_SCOPE } from '@core/templates/domain/definition/ControlField';

/**
 * Puts one kind of element back to moving the way its template moves
 * it: the answer the sheet gave is dropped, and every control the
 * template publishes over that kind's movement returns to the value its
 * variant ships.
 *
 * Both halves or neither. A sheet can have replaced the animation, or
 * tuned it, or moved a control the template's own keyframes read, and
 * usually some of each — undoing one and leaving the others is a state
 * the user never chose.
 *
 * No-op when the kind is already as the template has it, so the button
 * does not pollute the undo stack with empty entries.
 */
export class ResetSheetMotionAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(scope: ElementAnimationScope): void {
    const active = this.store.activeSheet();
    if (!active) return;

    const animations = active.animations.with(scope, undefined);
    const styleValues = this.controlsRestored(active, scope);
    if (animations === active.animations && styleValues === active.styleValues) return;

    this.store.commit('Reset motion', `resetMotion:${active.id}:${scope}`);
    const updated = active.with({ animations, styleValues });
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
    this.refresh.execute();
  }

  /** The same values with this kind's motion controls back at their shipped defaults. */
  private controlsRestored(active: Sheet, scope: ElementAnimationScope): StyleValues {
    const subgroup = MOTION_SUBGROUP_BY_SCOPE[scope];
    if (subgroup === null) return active.styleValues;
    const shipped = StyleValues.fromTemplateVariant(active.template, active.variantIndex);
    let restored = active.styleValues;
    for (const control of active.template.styleControls) {
      if (control.group !== 'motion' || control.subgroup !== subgroup) continue;
      const value = shipped.values[control.id];
      if (value === undefined || restored.values[control.id] === value) continue;
      restored = restored.withValue(control, value);
    }
    return restored;
  }
}
