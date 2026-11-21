import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { Sheet, SheetProps } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

export type SheetSlice = 'typography' | 'style' | 'position' | 'effects' | 'layout' | 'code';

/**
 * Restores one slice of the active Sheet to its template's defaults.
 * Slices match the editor sidebar's tabs: `code` covers both the CSS
 * and the `filters.svg` overrides because they share the Code tab;
 * `layout` covers both segment- and line-splitter configs for the same
 * reason; `position` covers alignment and rotation because both live
 * in the Position tab. Every slice except `position` triggers a
 * document re-derivation; position is purely visual.
 *
 * No-ops when the slice is already equal to its template default, so
 * the button doesn't pollute the undo stack with empty entries.
 */
export class ResetSheetSliceAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(slice: SheetSlice): void {
    const active = this.store.activeSheet();
    if (!active) return;

    const patch = this.buildPatch(active, slice);
    if (patch === null) return;

    const updated = active.with(patch);
    this.store.commit('Reset to template default', `reset:${active.id}:${slice}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
    if (slice !== 'position') this.refresh.execute();
  }

  private buildPatch(active: Sheet, slice: SheetSlice): Partial<SheetProps> | null {
    const template = active.template;
    switch (slice) {
      case 'typography': {
        if (sameJson(active.typographyConfig, template.typography)) return null;
        return { typographyConfig: template.typography };
      }
      case 'style': {
        const next = StyleValues.fromTemplateVariant(template, active.variantIndex);
        if (sameJson(active.styleValues.values, next.values)) return null;
        return { styleValues: next };
      }
      case 'position': {
        const alignmentSame = sameJson(active.alignmentConfig, template.alignment);
        const rotationSame = sameJson(active.rotationConfig, template.rotation);
        if (alignmentSame && rotationSame) return null;
        return {
          alignmentConfig: template.alignment,
          rotationConfig: template.rotation,
        };
      }
      case 'effects': {
        if (sameJson(active.effectConfigs, template.effectConfigs)) return null;
        return { effectConfigs: template.effectConfigs };
      }
      case 'layout': {
        const segSame = sameJson(active.segmentSplitterConfigs, template.segmentSplitterConfigs);
        const lineSame = sameJson(active.lineSplitterConfig, template.lineSplitter);
        const modesSame = sameJson(active.modeLayouts, active.templateModeLayouts());
        if (segSame && lineSame && modesSame) return null;
        return {
          segmentSplitterConfigs: template.segmentSplitterConfigs,
          lineSplitterConfig: template.lineSplitter,
          modeLayouts: active.templateModeLayouts(),
        };
      }
      case 'code': {
        if (active.cssOverride === null && active.filtersSvgOverride === null) return null;
        return { cssOverride: null, filtersSvgOverride: null };
      }
    }
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
