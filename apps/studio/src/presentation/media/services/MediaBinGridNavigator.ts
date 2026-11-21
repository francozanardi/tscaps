/** A key that moves the focus through the media bin's grid. */
export type MediaBinGridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const GRID_KEYS: ReadonlySet<string> = new Set<MediaBinGridKey>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * Where the focus goes in a grid of tiles laid out row by row, when a
 * key is pressed. Left and right walk the tiles in reading order,
 * crossing rows; up and down keep the column, and down onto a shorter
 * last row lands on its last tile. The focus never wraps around.
 */
export class MediaBinGridNavigator {
  isGridKey(key: string): key is MediaBinGridKey {
    return GRID_KEYS.has(key);
  }

  /**
   * The index the focus moves to from `index` among `count` tiles laid
   * out `columns` to a row; `index` itself when the key leads nowhere.
   */
  next(index: number, key: MediaBinGridKey, count: number, columns: number): number {
    if (count === 0) return index;
    const perRow = Math.max(1, Math.floor(columns));
    switch (key) {
      case 'ArrowLeft':
        return Math.max(0, index - 1);
      case 'ArrowRight':
        return Math.min(count - 1, index + 1);
      case 'ArrowUp':
        return index - perRow >= 0 ? index - perRow : index;
      case 'ArrowDown':
        return this.rowOf(index, perRow) < this.rowOf(count - 1, perRow) ? Math.min(count - 1, index + perRow) : index;
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
    }
  }

  private rowOf(index: number, perRow: number): number {
    return Math.floor(index / perRow);
  }
}
