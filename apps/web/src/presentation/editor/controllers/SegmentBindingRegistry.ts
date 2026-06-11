import type { SegmentDragTarget } from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Tracks the segments currently registered with the manipulation
 * controller so gestures can look up a segment's hitzone or wrapper
 * by id without each gesture maintaining its own copy of the table.
 * Owned by the controller, read by every gesture that needs cross-
 * segment context (drop-target detection, paint-all-on-drag, etc.).
 */
export class SegmentBindingRegistry {
  private readonly bindings = new Map<string, SegmentDragTarget>();

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

  clear(): void {
    this.bindings.clear();
  }
}
