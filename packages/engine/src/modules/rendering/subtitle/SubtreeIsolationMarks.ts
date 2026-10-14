import { CssClass } from '@modules/document/CssClass';

type Role = 'none' | 'original' | 'copy';

const NOTHING: ReadonlyArray<string> = [];
const HIDDEN: ReadonlyArray<string> = [CssClass.ISOLATION_HIDDEN];
const PATH: ReadonlyArray<string> = [CssClass.ISOLATION_PATH];
const KEPT: ReadonlyArray<string> = [CssClass.ISOLATION_KEPT];

/**
 * Which isolation classes each element of one segment subtree carries,
 * for the three subtrees an isolated element involves: one that knows
 * nothing of it, the original that hides it, and the copy that paints
 * only it.
 *
 * Inside a copy, a box holding something kept is a path — it lays the
 * kept element out and paints nothing of its own — and every other box
 * is hidden. Leaves are words and glyphs: a kept one carries nothing
 * and inherits its visibility, so an ancestor animating `visibility`
 * still hides it; a glyph inside its word inherits from the word
 * whichever way that goes, and is marked kept only when its word is
 * hidden and it is not, since it has nothing else to inherit from. A
 * glyph inside a kept word that another copy paints is hidden here, or
 * it would paint twice.
 */
export class SubtreeIsolationMarks {

  static none(): SubtreeIsolationMarks {
    return new SubtreeIsolationMarks('none', new Set(), new Set());
  }

  /** The original subtree, where `ids` are painted by copies and must not paint. */
  static hiding(ids: ReadonlySet<string>): SubtreeIsolationMarks {
    return ids.size === 0 ? SubtreeIsolationMarks.none() : new SubtreeIsolationMarks('original', ids, ids);
  }

  /** A copy that paints `ids` and nothing else; `isolatedIds` holds every element any copy of the segment paints. */
  static keeping(ids: ReadonlySet<string>, isolatedIds: ReadonlySet<string>): SubtreeIsolationMarks {
    return new SubtreeIsolationMarks('copy', ids, isolatedIds);
  }

  private constructor(
    private readonly role: Role,
    private readonly ids: ReadonlySet<string>,
    private readonly isolatedIds: ReadonlySet<string>,
  ) {}

  /** Whether this is a copy and `id` is what it paints. */
  keeps(id: string): boolean {
    return this.role === 'copy' && this.ids.has(id);
  }

  segmentClasses(): ReadonlyArray<string> {
    return this.role === 'copy' ? PATH : NOTHING;
  }

  /** For a line or a decoration container; `holdsKept` says whether anything this copy paints is inside it. */
  containerClasses(holdsKept: boolean): ReadonlyArray<string> {
    if (this.role !== 'copy') return NOTHING;
    return holdsKept ? PATH : HIDDEN;
  }

  /**
   * For a word, or a glyph. `hostWordId` is the word a glyph is painted
   * inside, `null` for a word or for a glyph painted outside its word.
   */
  leafClasses(id: string, hostWordId: string | null): ReadonlyArray<string> {
    if (this.role === 'none') return NOTHING;
    if (this.role === 'original') return this.ids.has(id) ? HIDDEN : NOTHING;
    if (this.ids.has(id)) return hostWordId !== null && !this.ids.has(hostWordId) ? KEPT : NOTHING;
    return hostWordId !== null && !this.isolatedIds.has(id) ? NOTHING : HIDDEN;
  }
}
