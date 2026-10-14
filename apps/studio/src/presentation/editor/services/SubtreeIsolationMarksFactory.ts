import { SubtreeIsolationMarks } from '@tscaps/engine';

/**
 * Hands out the engine's isolation marks to a layer that may not reach
 * the engine itself, so the preview stamps exactly what the export
 * stamps without deciding any of it.
 */
export class SubtreeIsolationMarksFactory {

  /** A subtree that knows nothing of isolation. */
  none(): SubtreeIsolationMarks {
    return SubtreeIsolationMarks.none();
  }

  /** The original subtree, where `ids` are painted by copies and must not paint. */
  hiding(ids: ReadonlySet<string>): SubtreeIsolationMarks {
    return SubtreeIsolationMarks.hiding(ids);
  }

  /** A copy that paints `ids` and nothing else; `isolatedIds` holds every element any copy of the segment paints. */
  keeping(ids: ReadonlySet<string>, isolatedIds: ReadonlySet<string>): SubtreeIsolationMarks {
    return SubtreeIsolationMarks.keeping(ids, isolatedIds);
  }
}
