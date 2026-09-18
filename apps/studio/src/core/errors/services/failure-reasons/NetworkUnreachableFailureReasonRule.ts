import { ModelFileRequestFailedError } from '@tscaps/engine';
import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';

/**
 * Recognises a request that never reached the host it was addressed
 * to: no route, no name resolution, a refused or cut connection, or
 * something in the network path dropping it. A host that answers is
 * not this condition, whatever it answered.
 *
 * Matching is by error name rather than by the browser's own
 * rejection, which is a bare `TypeError` on every engine and is
 * therefore indistinguishable from a programming fault. Only an
 * operation that has already decided a rejection was a transport
 * failure raises one of these, so the name is a signal where the
 * underlying value is not.
 *
 * Both `cause` and the `errors` of an `AggregateError` are followed,
 * so the condition stays recognisable after an operation has wrapped
 * it, and after a step that tried more than one route reported all of
 * them side by side.
 */
export class NetworkUnreachableFailureReasonRule implements FailureReasonRule {

  private static readonly UNREACHABLE_ERROR_NAMES: readonly string[] = [
    ModelFileRequestFailedError.ERROR_NAME,
  ];

  private static readonly MAX_DEPTH = 8;

  readonly reason: FailureReason = 'network-unreachable';

  matches(error: unknown): boolean {
    return this.matchesWithin(error, 0, new Set<object>());
  }

  private matchesWithin(candidate: unknown, depth: number, seen: Set<object>): boolean {
    if (depth >= NetworkUnreachableFailureReasonRule.MAX_DEPTH) return false;
    if (typeof candidate !== 'object' || candidate === null) return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    if (this.describesUnreachableHost(candidate)) return true;
    return this.linkedTo(candidate).some((linked) => this.matchesWithin(linked, depth + 1, seen));
  }

  private linkedTo(candidate: object): unknown[] {
    const branches = (candidate as { errors?: unknown }).errors;
    const linked = Array.isArray(branches) ? [...branches] : [];
    linked.push((candidate as { cause?: unknown }).cause);
    return linked;
  }

  private describesUnreachableHost(candidate: object): boolean {
    const name = (candidate as { name?: unknown }).name;
    return typeof name === 'string'
      && NetworkUnreachableFailureReasonRule.UNREACHABLE_ERROR_NAMES.includes(name);
  }
}
