import type { BehindActorOverride } from '@core/person-segmentation/domain/BehindActorOverride';

/** Plain shape for serialization. Keys are element ids; only elements the user answered for are present. */
export type BehindActorOverridesSnapshot = Readonly<Record<string, BehindActorOverride>>;

/**
 * The elements where the user has overruled whether they hide behind
 * the actor, keyed by element id — a scene, or a word inside one.
 *
 * An override in the same sense a style override is one: the sheet's
 * template decides this for a scene, and an entry here takes that
 * decision away from it. Absence means the template still decides, and
 * for a word, which no template decides for, that the word is in front.
 *
 * Its own store rather than a part of how an element is styled, because
 * the lifecycles differ: resetting a scene's layout drops what the user
 * shaped and deliberately leaves this standing, and unlike a style it
 * is not one of the reasons a segment is excluded from reflow.
 *
 * Immutable. Every mutator returns a new instance, and `'auto'` clears
 * the entry — absence and `'auto'` are the same state.
 */
export class BehindActorOverrideRegistry {
  static empty(): BehindActorOverrideRegistry {
    return new BehindActorOverrideRegistry(new Map());
  }

  static fromSnapshot(snapshot: BehindActorOverridesSnapshot): BehindActorOverrideRegistry {
    return new BehindActorOverrideRegistry(new Map(Object.entries(snapshot)));
  }

  private constructor(private readonly entries: ReadonlyMap<string, BehindActorOverride>) {}

  get(elementId: string): BehindActorOverride {
    return this.entries.get(elementId) ?? 'auto';
  }

  all(): ReadonlyMap<string, BehindActorOverride> {
    return this.entries;
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  with(elementId: string, override: BehindActorOverride): BehindActorOverrideRegistry {
    if (this.get(elementId) === override) return this;
    const next = new Map(this.entries);
    if (override === 'auto') next.delete(elementId);
    else next.set(elementId, override);
    return new BehindActorOverrideRegistry(next);
  }

  without(elementIds: Iterable<string>): BehindActorOverrideRegistry {
    let next: Map<string, BehindActorOverride> | null = null;
    for (const id of elementIds) {
      if (!this.entries.has(id)) continue;
      next ??= new Map(this.entries);
      next.delete(id);
    }
    return next ? new BehindActorOverrideRegistry(next) : this;
  }

  toSnapshot(): BehindActorOverridesSnapshot {
    return Object.fromEntries(this.entries);
  }
}
