import type { HistoryCheckpoint, HistoryTimeline } from '@core/editor/domain/HistoryCheckpoint';

/**
 * One row of the history graph: a checkpoint, the lane its dot sits in,
 * and the lines drawn across the row. `lineAbove` / `lineBelow` say
 * whether the dot's own lane goes on to a newer checkpoint above or to
 * an older one below. `through` lists the other lanes whose line crosses
 * the row untouched, and `joins` the lanes whose branch ends here,
 * curving from the top of the row into this row's dot.
 *
 * `onShownPath` is true for the start, the checkpoint shown, and every
 * checkpoint between them: what the project shown is made of.
 */
export interface HistoryGraphRow {
  readonly checkpoint: HistoryCheckpoint;
  readonly lane: number;
  readonly lineAbove: boolean;
  readonly lineBelow: boolean;
  readonly through: ReadonlyArray<number>;
  readonly joins: ReadonlyArray<number>;
  readonly isShown: boolean;
  readonly isSaved: boolean;
  readonly onShownPath: boolean;
}

/** The history graph: its rows, newest first, and how many lanes it needs. */
export interface HistoryGraph {
  readonly rows: ReadonlyArray<HistoryGraphRow>;
  readonly laneCount: number;
}

/** A run of checkpoints drawn in one lane: each the parent of the next, oldest first. */
interface Branch {
  readonly ids: ReadonlyArray<string>;
  /** The row of its newest checkpoint. */
  readonly topRow: number;
  /** The row the lane ends at: the parent its oldest checkpoint branched from, or its own row at the start. */
  readonly bottomRow: number;
  lane: number;
}

/**
 * Lays the edit history out as a graph read newest first, like a commit
 * graph. Lane 0 holds the line from the start to the checkpoint shown and
 * on through what a redo would bring back; every other branch takes the
 * leftmost lane free over the rows it spans. Layout only: what a row
 * says and how it is drawn belong to the view.
 */
export class HistoryGraphLayout {
  layOut(timeline: HistoryTimeline): HistoryGraph {
    const checkpoints = timeline.checkpoints;
    const byId = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
    const rowOf = new Map(checkpoints.map((checkpoint, index) => [checkpoint.id, checkpoints.length - 1 - index]));
    const childrenOf = this.childrenOf(checkpoints);
    const shownPath = this.pathToStart(timeline.headId, byId);

    const branches = this.branches(checkpoints, childrenOf, byId, rowOf, shownPath);
    this.assignLanes(branches);
    const branchOf = new Map<string, Branch>();
    for (const branch of branches) for (const id of branch.ids) branchOf.set(id, branch);

    const rows = [...checkpoints].reverse().map((checkpoint, row) => {
      const branch = branchOf.get(checkpoint.id)!;
      return {
        checkpoint,
        lane: branch.lane,
        lineAbove: row > branch.topRow,
        lineBelow: row < branch.bottomRow,
        through: branches.filter((other) => other !== branch && other.topRow < row && row < other.bottomRow).map((other) => other.lane),
        joins: branches.filter((other) => other !== branch && other.bottomRow === row).map((other) => other.lane),
        isShown: checkpoint.id === timeline.headId,
        isSaved: checkpoint.id === timeline.savedId,
        onShownPath: shownPath.has(checkpoint.id),
      };
    });
    const laneCount = branches.reduce((most, branch) => Math.max(most, branch.lane + 1), 1);
    return { rows, laneCount };
  }

  /**
   * Splits the tree into branches: first the shown line (the start to the
   * checkpoint shown, then on through each redo), then, in the order made,
   * a branch from every checkpoint not drawn yet down through its newest
   * children.
   */
  private branches(
    checkpoints: ReadonlyArray<HistoryCheckpoint>,
    childrenOf: ReadonlyMap<string, ReadonlyArray<HistoryCheckpoint>>,
    byId: ReadonlyMap<string, HistoryCheckpoint>,
    rowOf: ReadonlyMap<string, number>,
    shownPath: ReadonlySet<string>,
  ): Branch[] {
    const drawn = new Set<string>();
    const branches: Branch[] = [];
    const start = checkpoints[0];
    if (start === undefined) return branches;
    const mainIds = [...checkpoints.filter((checkpoint) => shownPath.has(checkpoint.id)).map((checkpoint) => checkpoint.id)];
    let tip = byId.get(mainIds[mainIds.length - 1]!)!;
    while (tip.redoChildId !== null) {
      mainIds.push(tip.redoChildId);
      tip = byId.get(tip.redoChildId)!;
    }
    branches.push(this.branchOf(mainIds, null, rowOf));
    for (const id of mainIds) drawn.add(id);

    for (const checkpoint of checkpoints) {
      if (drawn.has(checkpoint.id)) continue;
      const ids = [checkpoint.id];
      let newest = checkpoint;
      for (;;) {
        const children = (childrenOf.get(newest.id) ?? []).filter((child) => !drawn.has(child.id));
        const next = children[children.length - 1];
        if (next === undefined) break;
        ids.push(next.id);
        newest = next;
      }
      for (const id of ids) drawn.add(id);
      branches.push(this.branchOf(ids, checkpoint.parentId, rowOf));
    }
    return branches;
  }

  private branchOf(ids: ReadonlyArray<string>, parentId: string | null, rowOf: ReadonlyMap<string, number>): Branch {
    const topRow = rowOf.get(ids[ids.length - 1]!)!;
    const bottomRow = parentId === null ? rowOf.get(ids[0]!)! : rowOf.get(parentId)!;
    return { ids, topRow, bottomRow, lane: 0 };
  }

  /** Gives each branch after the first the leftmost lane whose last branch ended above it. */
  private assignLanes(branches: Branch[]): void {
    const laneEnds: number[] = [Number.POSITIVE_INFINITY];
    const rest = branches.slice(1).sort((first, second) => first.topRow - second.topRow);
    for (const branch of rest) {
      let lane = laneEnds.findIndex((end, index) => index > 0 && end < branch.topRow);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(branch.bottomRow);
      } else {
        laneEnds[lane] = branch.bottomRow;
      }
      branch.lane = lane;
    }
  }

  private childrenOf(checkpoints: ReadonlyArray<HistoryCheckpoint>): Map<string, HistoryCheckpoint[]> {
    const children = new Map<string, HistoryCheckpoint[]>();
    for (const checkpoint of checkpoints) {
      if (checkpoint.parentId === null) continue;
      const siblings = children.get(checkpoint.parentId) ?? [];
      siblings.push(checkpoint);
      children.set(checkpoint.parentId, siblings);
    }
    return children;
  }

  private pathToStart(id: string, byId: ReadonlyMap<string, HistoryCheckpoint>): Set<string> {
    const path = new Set<string>();
    let current = byId.get(id);
    while (current !== undefined) {
      path.add(current.id);
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return path;
  }
}
