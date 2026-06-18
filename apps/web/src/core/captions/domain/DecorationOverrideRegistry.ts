import type { DecorationOverride } from '@core/captions/domain/DecorationOverride';

export type DecorationOverridesSnapshot = Readonly<Record<string, DecorationOverride>>;

const EMPTY: DecorationOverride = {};

/**
 * Per-decoration overrides keyed by `Decoration.id`. The document
 * deriver reads the entries when piping the document and applies them
 * to every matching decoration before rendering.
 *
 * Immutable. `with()` returns a new instance; passing an empty
 * override record drops the entry.
 */
export class DecorationOverrideRegistry {
  static empty(): DecorationOverrideRegistry {
    return new DecorationOverrideRegistry(new Map());
  }

  static fromRecord(record: DecorationOverridesSnapshot): DecorationOverrideRegistry {
    return new DecorationOverrideRegistry(new Map(Object.entries(record)));
  }

  private constructor(
    private readonly entries: ReadonlyMap<string, DecorationOverride>,
  ) {}

  get(decorationId: string): DecorationOverride {
    return this.entries.get(decorationId) ?? EMPTY;
  }

  hasAnyFor(decorationId: string): boolean {
    const override = this.entries.get(decorationId);
    return override !== undefined && Object.keys(override).length > 0;
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  with(decorationId: string, override: DecorationOverride): DecorationOverrideRegistry {
    const next = new Map(this.entries);
    if (Object.keys(override).length === 0) next.delete(decorationId);
    else next.set(decorationId, override);
    return new DecorationOverrideRegistry(next);
  }

  toRecord(): DecorationOverridesSnapshot {
    const out: Record<string, DecorationOverride> = {};
    for (const [k, v] of this.entries) out[k] = v;
    return out;
  }
}
