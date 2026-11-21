import type { HistoryAuthor, HistoryCheckpoint, HistoryTimeline } from '@core/editor/domain/HistoryCheckpoint';
import type { HistoryGroup } from '@core/editor/domain/HistoryGroup';

const COALESCE_WINDOW_MS = 500;

/** What a change is recorded as: its label, and the key that lets the next change of the same kind extend it. */
export interface HistoryChange {
  readonly label: string;
  readonly coalesceKey?: string;
  readonly group?: HistoryGroup;
}

interface CheckpointNode<T> {
  readonly id: string;
  readonly parentId: string | null;
  snapshot: T;
  /** The title given to it; null while it goes by its changes. */
  title: string | null;
  changes: string[];
  readonly author: HistoryAuthor;
  readonly groupKey: string | null;
  coalesceKey: string | undefined;
  readonly createdAt: number;
  updatedAt: number;
  /** The child a redo goes to: the one last left by an undo or a jump, else the one made last. */
  redoChildId: string | null;
}

/**
 * The edit history as a tree of checkpoints, each holding the state after
 * its change. The head is the checkpoint the editor shows; its snapshot is
 * refreshed with the state passed in whenever the head is left, so changes
 * made without a recorded change still belong to it.
 *
 * Recording a change makes a child of the head, so a change made after
 * going back starts a branch and the checkpoints it replaced stay
 * reachable. Undo goes to the parent, redo to the child last left, and a
 * jump goes anywhere. A change with the same non-empty coalesce key as the
 * head's, within COALESCE_WINDOW_MS (or at any distance for a group),
 * extends the head instead; any navigation, and saving, seals the head so
 * the next change never folds across them.
 */
export class CheckpointHistory<T> {
  private nodes = new Map<string, CheckpointNode<T>>();
  private order: string[] = [];
  private headId = '';
  private savedId: string | null = null;
  private groupTitles = new Map<string, string>();
  private nextId = 0;
  private cachedTimeline: HistoryTimeline | null = null;

  constructor(start: T, startTitle: string) {
    this.reset(start, startTitle);
  }

  /** Drops every checkpoint and starts again from `start`. */
  reset(start: T, startTitle: string): void {
    this.nodes = new Map();
    this.order = [];
    this.savedId = null;
    this.groupTitles = new Map();
    this.headId = this.add(null, start, startTitle, 'person', null, undefined).id;
  }

  /**
   * Records that a change is about to be made to `current`, the state the
   * head now stands for: the change becomes a new checkpoint after the
   * head, or extends the head when it coalesces with it.
   */
  record(current: T, change: HistoryChange): void {
    const head = this.head();
    head.snapshot = current;
    const coalesceKey = change.group?.key ?? change.coalesceKey;
    if (this.extendsHead(head, coalesceKey, change.group !== undefined)) {
      head.updatedAt = Date.now();
      if (!head.changes.includes(change.label)) head.changes.push(change.label);
    } else {
      const groupKey = change.group?.key ?? null;
      const title = (groupKey !== null ? this.groupTitles.get(groupKey) : undefined) ?? null;
      const node = this.add(head.id, current, title, change.group?.author ?? 'person', groupKey, coalesceKey);
      node.changes = [change.label];
      head.redoChildId = node.id;
      this.headId = node.id;
    }
    this.changed();
  }

  /** Moves the head to its parent and returns that checkpoint's state; null at the start. */
  undo(current: T): T | null {
    const head = this.head();
    if (head.parentId === null) return null;
    return this.moveTo(head.parentId, current);
  }

  /** Moves the head to the child a redo goes to and returns its state; null when the head has no child. */
  redo(current: T): T | null {
    const childId = this.redoChildOf(this.head());
    if (childId === null) return null;
    return this.moveTo(childId, current);
  }

  /** Moves the head to the checkpoint `id` and returns its state; null when it is the head or does not exist. */
  jumpTo(id: string, current: T): T | null {
    if (id === this.headId || !this.nodes.has(id)) return null;
    return this.moveTo(id, current);
  }

  canUndo(): boolean {
    return this.head().parentId !== null;
  }

  canRedo(): boolean {
    return this.redoChildOf(this.head()) !== null;
  }

  /** Whether the head is the checkpoint last marked saved. */
  isAtSaved(): boolean {
    return this.savedId === this.headId;
  }

  /** Marks the head as the checkpoint last saved, and seals it. */
  markSaved(): void {
    const head = this.head();
    head.coalesceKey = undefined;
    if (this.savedId === head.id) return;
    this.savedId = head.id;
    this.changed();
  }

  /**
   * Titles every checkpoint of the group `groupKey`, and every one the group
   * makes after. True when the group has a checkpoint to title; false, with
   * nothing titled or kept, for a group that made no change or an empty title.
   */
  titleGroup(groupKey: string, title: string): boolean {
    const trimmed = title.trim();
    const members = [...this.nodes.values()].filter((node) => node.groupKey === groupKey);
    if (trimmed === '' || members.length === 0) return false;
    this.groupTitles.set(groupKey, trimmed);
    for (const node of members) node.title = trimmed;
    this.changed();
    return true;
  }

  /** Rewrites every snapshot held, keeping the tree as it is. */
  reviseAll(revise: (snapshot: T) => T): void {
    for (const node of this.nodes.values()) node.snapshot = revise(node.snapshot);
  }

  /** The history as it is now. The same object until the history changes. */
  timeline(): HistoryTimeline {
    if (this.cachedTimeline === null) {
      this.cachedTimeline = {
        checkpoints: this.order.map((id) => this.describe(this.nodes.get(id)!)),
        headId: this.headId,
        savedId: this.savedId,
      };
    }
    return this.cachedTimeline;
  }

  private moveTo(targetId: string, current: T): T {
    const head = this.head();
    head.snapshot = current;
    head.coalesceKey = undefined;
    this.pointRedoAt(head);
    const target = this.nodes.get(targetId)!;
    target.coalesceKey = undefined;
    this.headId = targetId;
    this.changed();
    return target.snapshot;
  }

  /** Points every ancestor's redo at the path down to `node`, so redoing from any of them leads back to it. */
  private pointRedoAt(node: CheckpointNode<T>): void {
    let child = node;
    while (child.parentId !== null) {
      const parent = this.nodes.get(child.parentId)!;
      parent.redoChildId = child.id;
      child = parent;
    }
  }

  private extendsHead(head: CheckpointNode<T>, coalesceKey: string | undefined, grouped: boolean): boolean {
    return coalesceKey !== undefined
      && head.coalesceKey === coalesceKey
      && head.id !== this.savedId
      && (grouped || Date.now() - head.updatedAt < COALESCE_WINDOW_MS);
  }

  private redoChildOf(node: CheckpointNode<T>): string | null {
    if (node.redoChildId !== null) return node.redoChildId;
    for (let index = this.order.length - 1; index >= 0; index -= 1) {
      const candidate = this.nodes.get(this.order[index]!)!;
      if (candidate.parentId === node.id) return candidate.id;
    }
    return null;
  }

  private add(
    parentId: string | null,
    snapshot: T,
    title: string | null,
    author: HistoryAuthor,
    groupKey: string | null,
    coalesceKey: string | undefined,
  ): CheckpointNode<T> {
    const now = Date.now();
    const node: CheckpointNode<T> = {
      id: `checkpoint-${this.nextId}`,
      parentId,
      snapshot,
      title,
      changes: [],
      author,
      groupKey,
      coalesceKey,
      createdAt: now,
      updatedAt: now,
      redoChildId: null,
    };
    this.nextId += 1;
    this.nodes.set(node.id, node);
    this.order.push(node.id);
    this.changed();
    return node;
  }

  private describe(node: CheckpointNode<T>): HistoryCheckpoint {
    return {
      id: node.id,
      parentId: node.parentId,
      title: node.title ?? this.titleFromChanges(node.changes),
      changes: [...node.changes],
      author: node.author,
      groupKey: node.groupKey,
      redoChildId: this.redoChildOf(node),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }

  /** "Change typography", or "Change typography + 2 more" for a checkpoint holding several kinds of edit. */
  private titleFromChanges(changes: ReadonlyArray<string>): string {
    const [first] = changes;
    if (first === undefined) return '';
    return changes.length === 1 ? first : `${first} + ${changes.length - 1} more`;
  }

  private head(): CheckpointNode<T> {
    return this.nodes.get(this.headId)!;
  }

  private changed(): void {
    this.cachedTimeline = null;
  }
}
