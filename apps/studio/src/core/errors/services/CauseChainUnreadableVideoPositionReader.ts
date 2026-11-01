import { VideoFrameDecodeFailedError } from '@tscaps/engine';
import type { UnreadableVideoPositionReader } from '@core/errors/domain/UnreadableVideoPositionReader';

/**
 * `UnreadableVideoPositionReader` that looks for the engine's decode
 * failure anywhere a thrown value links to.
 *
 * Both `cause` and the `errors` of an `AggregateError` are followed, so
 * the position survives the operations that wrap the decoder's error
 * in their own. Matching is by error name, which survives a boundary
 * that does not keep class identity.
 */
export class CauseChainUnreadableVideoPositionReader implements UnreadableVideoPositionReader {

  private static readonly MAX_DEPTH = 8;

  positionIn(error: unknown): number | null {
    return this.positionWithin(error, 0, new Set<object>());
  }

  private positionWithin(candidate: unknown, depth: number, seen: Set<object>): number | null {
    if (depth >= CauseChainUnreadableVideoPositionReader.MAX_DEPTH) return null;
    if (typeof candidate !== 'object' || candidate === null) return null;
    if (seen.has(candidate)) return null;
    seen.add(candidate);
    const own = this.ownPosition(candidate);
    if (own !== null) return own;
    for (const linked of this.linkedTo(candidate)) {
      const position = this.positionWithin(linked, depth + 1, seen);
      if (position !== null) return position;
    }
    return null;
  }

  private ownPosition(candidate: object): number | null {
    const { name, decodedUntilSec } = candidate as { name?: unknown; decodedUntilSec?: unknown };
    if (name !== VideoFrameDecodeFailedError.ERROR_NAME) return null;
    if (typeof decodedUntilSec !== 'number' || !Number.isFinite(decodedUntilSec)) return null;
    return decodedUntilSec > 0 ? decodedUntilSec : null;
  }

  private linkedTo(candidate: object): unknown[] {
    const branches = (candidate as { errors?: unknown }).errors;
    const linked = Array.isArray(branches) ? [...branches] : [];
    linked.push((candidate as { cause?: unknown }).cause);
    return linked;
  }
}
