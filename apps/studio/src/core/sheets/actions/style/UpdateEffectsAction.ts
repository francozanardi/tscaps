import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Replaces a single effect's config on the active Sheet (matched by `type`)
 * and re-derives the document. Re-derivation runs the effect pipeline
 * stage from scratch on the raw transcribed document, so toggling an
 * effect off restores the original timing — there is no state drift.
 * When the sheet belongs to a link group, the same effect config rides
 * across to every linked sibling.
 */
export class UpdateEffectsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(updated: EffectConfig): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const next = active.effectConfigs.map((c) => (c.type === updated.type ? updated : c));
    const updatedSheet = active.with({ effectConfigs: next });
    this.store.commit('Change effect', `effects:${active.id}:${updated.type}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updatedSheet, this.store.snapshot().sheets) });
    this.refresh.execute();
  }
}
