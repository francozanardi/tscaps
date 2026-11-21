import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Links a target sheet into another sheet's link group. When the source
 * is unlinked, a fresh group id is minted and both sheets adopt it; when
 * the source already belongs to a group, the target joins that group.
 *
 * The target adopts the source's shared-style snapshot as if it had been
 * a group member all along: typography, splitters, alignment, rotation,
 * effects, css and filters overrides are copied straight; `styleValues`
 * is rebuilt on the target's own variant baseline so the target keeps its
 * preset (color, etc.) while inheriting the group's user edits. `template`,
 * `id`, `name`, `color`, and `variantIndex` stay untouched on the target.
 *
 * No-ops when both sheets are the same, when the target already belongs
 * to a group (unlink first), or when either sheet cannot be found.
 */
export class LinkSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly sync: LinkedSheetsSync,
  ) {}

  execute(targetSheetId: string, sourceSheetId: string): void {
    if (targetSheetId === sourceSheetId) return;
    const { sheets } = this.store.snapshot();
    const target = sheets.find((s) => s.id === targetSheetId);
    const source = sheets.find((s) => s.id === sourceSheetId);
    if (!target || !source) return;
    if (target.linkGroupId !== null) return;

    const groupId = source.linkGroupId ?? crypto.randomUUID();
    const nextSource = source.linkGroupId === null
      ? source.with({ linkGroupId: groupId })
      : source;
    const adopted = this.sync.adoptGroupStyleFrom(target, nextSource);
    const nextTarget = adopted.with({ linkGroupId: groupId });

    const nextSheets = sheets.map((s) => {
      if (s.id === nextTarget.id) return nextTarget;
      if (s.id === nextSource.id) return nextSource;
      return s;
    });

    this.store.commit('Link sheet');
    this.store.patch({ sheets: nextSheets });
    this.refresh.execute();
  }
}
