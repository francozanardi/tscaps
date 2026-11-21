import type { AudioEffectRow } from '@presentation/audio-mix/services/AudioTabPresenter';

/**
 * Keeps the effects list in the order it was shown while it stays on
 * screen, so a row the user just changed does not jump away from under
 * the pointer: moving an effect onto another word changes where it
 * plays, not where its row sits. The list is in play order again the
 * next time it is shown.
 */
export class HeldEffectRowOrder {
  /**
   * The rows in the held order: those already shown keep their places,
   * a row gone is dropped, and a row not shown before goes right after
   * the row it follows in play order (first when it follows none).
   *
   * @param heldClipIds The clip ids in the order last shown.
   * @param rows Every row, in play order.
   */
  arrange(heldClipIds: readonly string[], rows: readonly AudioEffectRow[]): AudioEffectRow[] {
    const byClipId = new Map(rows.map((row) => [row.clip.id, row]));
    const arranged = heldClipIds.flatMap((clipId) => {
      const row = byClipId.get(clipId);
      return row === undefined ? [] : [row];
    });
    rows.forEach((row, index) => {
      if (arranged.includes(row)) return;
      arranged.splice(this.insertionIndex(arranged, rows, index), 0, row);
    });
    return arranged;
  }

  /** Right after the nearest row before `index` in play order that is already placed, or first. */
  private insertionIndex(arranged: readonly AudioEffectRow[], rows: readonly AudioEffectRow[], index: number): number {
    for (let before = index - 1; before >= 0; before--) {
      const placed = arranged.indexOf(rows[before]!);
      if (placed !== -1) return placed + 1;
    }
    return 0;
  }
}
