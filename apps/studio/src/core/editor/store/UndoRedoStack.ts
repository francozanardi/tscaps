const COALESCE_WINDOW_MS = 500;

interface StackEntry<T> {
  snapshot: T;
  coalesceKey: string | undefined;
  timestamp: number;
}

/**
 * Two-stack undo/redo with timestamp-based coalescing. Successive pushes
 * within COALESCE_WINDOW_MS that share a non-empty coalesceKey extend the
 * existing entry instead of stacking, so a slider drag becomes a single
 * undo step. Any push without a coalesceKey, or with a different key, seals
 * the previous entry. undo/redo also seal the new top so a follow-up edit
 * never collapses across a navigation boundary.
 */
export class UndoRedoStack<T> {
  private _undo: StackEntry<T>[] = [];
  private _redo: StackEntry<T>[] = [];

  push(snapshot: T, coalesceKey?: string): void {
    const last = this._undo[this._undo.length - 1];
    const now = Date.now();
    const canCoalesce =
      coalesceKey !== undefined &&
      last !== undefined &&
      last.coalesceKey === coalesceKey &&
      now - last.timestamp < COALESCE_WINDOW_MS;

    if (canCoalesce) {
      last!.timestamp = now;
    } else {
      this._undo.push({ snapshot, coalesceKey, timestamp: now });
    }
    this._redo = [];
  }

  undo(currentSnapshot: T): T | null {
    const prev = this._undo.pop();
    if (!prev) return null;
    this._redo.push({ snapshot: currentSnapshot, coalesceKey: undefined, timestamp: Date.now() });
    this._sealTop();
    return prev.snapshot;
  }

  redo(currentSnapshot: T): T | null {
    const next = this._redo.pop();
    if (!next) return null;
    this._undo.push({ snapshot: currentSnapshot, coalesceKey: undefined, timestamp: Date.now() });
    return next.snapshot;
  }

  canUndo(): boolean {
    return this._undo.length > 0;
  }

  canRedo(): boolean {
    return this._redo.length > 0;
  }

  clear(): void {
    this._undo = [];
    this._redo = [];
  }

  private _sealTop(): void {
    const top = this._undo[this._undo.length - 1];
    if (top) top.coalesceKey = undefined;
  }
}
