import type { Document, Word } from '@tscaps/engine';
import { CutRegistry, type CutRange } from '@core/cuts/domain/CutRegistry';

/**
 * Post-processes a cut registry to fuse pairs of cuts that are
 * separated only by silence — i.e. whose gap contains no word the
 * playback would actually hear. This eliminates the
 * `| cut | silence | cut |` orphan that auto-cut tools leave behind
 * when their boundaries leak a few milliseconds of dead air between
 * each other (e.g. a silence cut shrunk by its padder against a
 * bad-take cut). Order in which cuts were added is irrelevant; the
 * compactor walks the registry from scratch.
 *
 * The registry's own `add` already merges overlapping cuts; this
 * service handles the case where the cuts touch but do not overlap.
 */
export class CutCompactor {

  compact(registry: CutRegistry, document: Document): CutRegistry {
    const ordered = [...registry.list()].sort((a, b) => a.startSec - b.startSec);
    if (ordered.length < 2) return registry;
    const words = document.getWords();
    const result: CutRange[] = [];
    let current = ordered[0]!;
    for (let i = 1; i < ordered.length; i++) {
      const next = ordered[i]!;
      if (this.hasWordOverlapping(words, current.endSec, next.startSec)) {
        result.push(current);
        current = next;
        continue;
      }
      current = { startSec: current.startSec, endSec: Math.max(current.endSec, next.endSec) };
    }
    result.push(current);
    if (result.length === ordered.length) return registry;
    return CutRegistry.fromSnapshot(result);
  }

  private hasWordOverlapping(words: ReadonlyArray<Word>, startSec: number, endSec: number): boolean {
    if (endSec <= startSec) return false;
    for (const word of words) {
      if (word.time.start < endSec && word.time.end > startSec) return true;
    }
    return false;
  }
}
