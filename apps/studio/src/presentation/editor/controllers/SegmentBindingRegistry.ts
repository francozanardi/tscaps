import type { SegmentDragTarget } from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Tracks the segments currently registered with the manipulation
 * controller so gestures can look up a segment's element or wrapper
 * by id without each gesture maintaining its own copy of the table.
 * Owned by the controller, read by every gesture that needs cross-
 * segment context (drop-target detection, paint-all-on-drag, etc.).
 */
export class SegmentBindingRegistry {
  private readonly bindings = new Map<string, SegmentDragTarget>();
  private readonly copies = new Map<string, Set<HTMLElement>>();

  register(target: SegmentDragTarget): void {
    this.bindings.set(target.segmentId, target);
  }

  unregister(segmentId: string): void {
    this.bindings.delete(segmentId);
  }

  get(segmentId: string): SegmentDragTarget | null {
    return this.bindings.get(segmentId) ?? null;
  }

  all(): IterableIterator<SegmentDragTarget> {
    return this.bindings.values();
  }

  /**
   * Records the wrapper of a copy of the segment's subtree, which mounts
   * and unmounts on its own schedule — the original's binding may come
   * and go around it. Returns the matching unregister.
   */
  registerCopy(segmentId: string, wrapper: HTMLElement): () => void {
    const wrappers = this.copies.get(segmentId) ?? new Set<HTMLElement>();
    wrappers.add(wrapper);
    this.copies.set(segmentId, wrappers);
    return () => {
      wrappers.delete(wrapper);
      if (wrappers.size === 0 && this.copies.get(segmentId) === wrappers) this.copies.delete(segmentId);
    };
  }

  /** The copy wrappers currently mounted for the segment, in no particular order. */
  copiesOf(segmentId: string): ReadonlyArray<HTMLElement> {
    return [...(this.copies.get(segmentId) ?? [])];
  }

  clear(): void {
    this.bindings.clear();
    this.copies.clear();
  }
}
