import type { SegmentVisibilityOverride } from '@core/captions/domain/SegmentVisibilityOverride';

/** Plain shape for serialization. Keys are segment ids; only scenes the user answered for are present. */
export type SegmentVisibilityOverridesSnapshot = Readonly<Record<string, Exclude<SegmentVisibilityOverride, 'auto'>>>;

/**
 * The scenes where the user has overruled whether they are painted,
 * keyed by segment id. Absence means the brief-scene rule decides.
 *
 * Keyed by id, so an answer lasts while the scene does: a re-split that
 * keeps a scene's words keeps its id, and one that regroups them makes
 * scenes nobody answered for.
 *
 * Immutable. Every mutator returns a new instance, and `'auto'` clears
 * the entry — absence and `'auto'` are the same state.
 */
export class SegmentVisibilityOverrideRegistry {
  static empty(): SegmentVisibilityOverrideRegistry {
    return new SegmentVisibilityOverrideRegistry(new Map());
  }

  static fromSnapshot(snapshot: SegmentVisibilityOverridesSnapshot): SegmentVisibilityOverrideRegistry {
    return new SegmentVisibilityOverrideRegistry(new Map(Object.entries(snapshot)));
  }

  private constructor(private readonly entries: ReadonlyMap<string, Exclude<SegmentVisibilityOverride, 'auto'>>) {}

  get(segmentId: string): SegmentVisibilityOverride {
    return this.entries.get(segmentId) ?? 'auto';
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  with(segmentId: string, override: SegmentVisibilityOverride): SegmentVisibilityOverrideRegistry {
    if (this.get(segmentId) === override) return this;
    const next = new Map(this.entries);
    if (override === 'auto') next.delete(segmentId);
    else next.set(segmentId, override);
    return new SegmentVisibilityOverrideRegistry(next);
  }

  toSnapshot(): SegmentVisibilityOverridesSnapshot {
    return Object.fromEntries(this.entries);
  }
}
