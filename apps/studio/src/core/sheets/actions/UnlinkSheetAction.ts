import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Removes a sheet from its link group by clearing its `linkGroupId`.
 * If the removal leaves the group with a single remaining member, that
 * member's `linkGroupId` is cleared too — a group of one carries no
 * meaning and the chain icon should read as unlinked in the sidebar.
 *
 * The sheet's shared-style snapshot is left as-is: an unlinked sheet
 * keeps whatever style it had at the moment of unlink. No-ops when the
 * sheet cannot be found or is already unlinked.
 */
export class UnlinkSheetAction {
  constructor(private readonly store: EditorStore) {}

  execute(sheetId: string): void {
    const { sheets } = this.store.snapshot();
    const target = sheets.find((s) => s.id === sheetId);
    if (!target || target.linkGroupId === null) return;

    const groupId = target.linkGroupId;
    const remainingIdsInGroup = sheets
      .filter((s) => s.linkGroupId === groupId && s.id !== target.id)
      .map((s) => s.id);
    const shouldDissolveGroup = remainingIdsInGroup.length === 1;

    const nextSheets = sheets.map((s) => {
      if (s.id === target.id) return s.with({ linkGroupId: null });
      if (shouldDissolveGroup && s.id === remainingIdsInGroup[0]) {
        return s.with({ linkGroupId: null });
      }
      return s;
    });

    this.store.commit('Unlink sheet');
    this.store.patch({ sheets: nextSheets });
  }
}
