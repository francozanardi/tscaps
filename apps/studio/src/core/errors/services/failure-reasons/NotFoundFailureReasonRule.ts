import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';
import { ProjectNotFoundError } from '@core/projects/domain/errors/ProjectNotFoundError';

/**
 * Recognises an operation that was handed an id nothing is stored
 * under. Nothing broke: what was asked for is not there, and no
 * retry of any kind will change that.
 *
 * Matches by error name across the `cause` chain, mirroring the other
 * rules in this folder. The name string is read off the error class so
 * a rename is caught at compile time.
 */
export class NotFoundFailureReasonRule implements FailureReasonRule {

  private static readonly NOT_FOUND_ERROR_NAMES: readonly string[] = [
    ProjectNotFoundError.ERROR_NAME,
  ];

  private static readonly MAX_CAUSE_DEPTH = 8;

  readonly reason: FailureReason = 'not-found';

  matches(error: unknown): boolean {
    let candidate = error;
    for (let depth = 0; depth < NotFoundFailureReasonRule.MAX_CAUSE_DEPTH; depth += 1) {
      if (typeof candidate !== 'object' || candidate === null) return false;
      const name = (candidate as { name?: unknown }).name;
      if (typeof name === 'string' && NotFoundFailureReasonRule.NOT_FOUND_ERROR_NAMES.includes(name)) {
        return true;
      }
      candidate = (candidate as { cause?: unknown }).cause;
    }
    return false;
  }
}
