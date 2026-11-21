import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';

/**
 * Central choke point for style propagation across linked sheets. Every
 * mutation on a sheet that carries a `linkGroupId` routes through here
 * so its siblings adopt the same edit atomically.
 *
 * Two shapes of edit are exposed as separate methods because the
 * mechanics differ:
 *
 * - `applyStyleEdit` covers every shared field that is copy-safe (typography,
 *   splitters, alignment, rotation, effects, css / filters overrides) plus
 *   `styleValues`, which is not copy-safe. `styleValues` mixes template
 *   defaults, variant overrides, and user edits into a single map; a raw
 *   copy would drag the source's variant colors onto the target. The service
 *   diffs the source's `styleValues` against its own variant baseline to
 *   isolate the user-edit overlay and re-applies it on top of each target's
 *   own variant baseline, so per-speaker presets survive.
 *
 * - `applyTemplateEdit` covers `SetTemplateAction`. Each sibling calls
 *   `withTemplate` on its own so the new template's defaults land, its
 *   `variantIndex` is carried over untouched, and the styleValues are
 *   re-seeded from the sibling's own variant baseline. No delta is needed
 *   after a template switch because the operation resets every shared
 *   field on both the source and its siblings.
 *
 * Both methods return the full replacement sheets array (source updated
 * plus siblings synchronised) and publish a propagation event when at
 * least one sibling was updated. Callers pass the returned array straight
 * to `EditorStore.patch`.
 *
 * Private fields (`id`, `name`, `color`, `variantIndex`, `linkGroupId`)
 * are never propagated — those changes go through `EditorStore.replaceSheet`
 * directly, bypassing this service.
 */
export class LinkedSheetsSync {
  constructor(
    private readonly notifier: LinkedSheetsPropagationNotifier,
  ) {}

  /**
   * Replaces the source sheet in the array and, when the source is part of
   * a link group, syncs every sibling to the same shared-style snapshot.
   * The source's variant, id, name, and color stay unique per sheet; the
   * styleValues user-edit overlay and every direct-copy field ride across.
   */
  applyStyleEdit(updatedSource: Sheet, sheets: ReadonlyArray<Sheet>): Sheet[] {
    const groupId = updatedSource.linkGroupId;
    if (groupId === null) return this.replaceOne(updatedSource, sheets);

    const overlay = this.extractUserEditOverlay(updatedSource);
    let propagatedCount = 0;
    const next = sheets.map((sheet) => {
      if (sheet.id === updatedSource.id) return updatedSource;
      if (sheet.linkGroupId !== groupId) return sheet;
      propagatedCount += 1;
      return this.syncSiblingStyle(sheet, updatedSource, overlay);
    });

    if (propagatedCount > 0) {
      this.notifier.notifyPropagation({ groupId, propagatedCount });
    }
    return next;
  }

  /**
   * Replaces the source sheet in the array and, when the source is part of
   * a link group, switches every sibling to the same template while each
   * keeps its own `variantIndex`.
   * Every shared field falls back to the new template's defaults on both
   * source and siblings — the same reset `withTemplate` performs solo.
   */
  applyTemplateEdit(updatedSource: Sheet, sheets: ReadonlyArray<Sheet>): Sheet[] {
    const groupId = updatedSource.linkGroupId;
    if (groupId === null) return this.replaceOne(updatedSource, sheets);

    let propagatedCount = 0;
    const next = sheets.map((sheet) => {
      if (sheet.id === updatedSource.id) return updatedSource;
      if (sheet.linkGroupId !== groupId) return sheet;
      propagatedCount += 1;
      return sheet.withTemplate(updatedSource.template);
    });

    if (propagatedCount > 0) {
      this.notifier.notifyPropagation({ groupId, propagatedCount });
    }
    return next;
  }

  /**
   * Rebases `target` onto `source`'s shared-style snapshot as if `target`
   * had just been added to `source`'s link group. Exposed for the link
   * action so the newly linked sheet adopts the group's look without
   * running a mock edit through the full propagation path.
   */
  adoptGroupStyleFrom(target: Sheet, source: Sheet): Sheet {
    const overlay = this.extractUserEditOverlay(source);
    return this.syncSiblingStyle(target, source, overlay);
  }

  /**
   * Ids of every sheet a style edit on `source` lands on: the sheet
   * itself, plus every member of its link group. Answers the question
   * `applyStyleEdit` acts on, without performing the edit.
   */
  styleEditReach(source: Sheet, sheets: ReadonlyArray<Sheet>): ReadonlySet<string> {
    const ids = new Set<string>([source.id]);
    const groupId = source.linkGroupId;
    if (groupId === null) return ids;
    for (const sheet of sheets) {
      if (sheet.linkGroupId === groupId) ids.add(sheet.id);
    }
    return ids;
  }

  private replaceOne(updatedSource: Sheet, sheets: ReadonlyArray<Sheet>): Sheet[] {
    return sheets.map((sheet) => (sheet.id === updatedSource.id ? updatedSource : sheet));
  }

  private syncSiblingStyle(target: Sheet, source: Sheet, overlay: UserEditOverlay): Sheet {
    return target.with({
      typographyConfig: source.typographyConfig,
      rotationConfig: source.rotationConfig,
      alignmentConfig: source.alignmentConfig,
      segmentSplitterConfigs: source.segmentSplitterConfigs,
      lineSplitterConfig: source.lineSplitterConfig,
      modeLayouts: source.modeLayouts,
      effectConfigs: source.effectConfigs,
      animations: source.animations,
      cssOverride: source.cssOverride,
      filtersSvgOverride: source.filtersSvgOverride,
      styleValues: this.rebuildStyleValuesForTarget(target, overlay),
    });
  }

  /**
   * Isolates the user-edit overlay carried by a source sheet: the
   * `(fieldId, value)` pairs whose value diverges from what the source's
   * template + variant would seed by itself. Anything matching the
   * variant baseline stays unrecorded so it never leaks into a target
   * sitting on a different variant.
   */
  private extractUserEditOverlay(source: Sheet): UserEditOverlay {
    const baseline = StyleValues.fromTemplateVariant(source.template, source.variantIndex).values;
    const overlay: Record<string, ControlValue> = {};
    for (const [fieldId, value] of Object.entries(source.styleValues.values)) {
      if (baseline[fieldId] === value) continue;
      overlay[fieldId] = value;
    }
    return overlay;
  }

  private rebuildStyleValuesForTarget(target: Sheet, overlay: UserEditOverlay): StyleValues {
    let rebuilt = StyleValues.fromTemplateVariant(target.template, target.variantIndex);
    for (const [fieldId, value] of Object.entries(overlay)) {
      const field = this.findControlField(target, fieldId);
      if (field === null) continue;
      rebuilt = rebuilt.withValue(field, value);
    }
    return rebuilt;
  }

  private findControlField(sheet: Sheet, fieldId: string): ControlField | null {
    for (const field of sheet.template.styleControls) {
      if (field.id === fieldId) return field;
    }
    return null;
  }
}

type UserEditOverlay = Readonly<Record<string, ControlValue>>;
