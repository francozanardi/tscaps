import { IndexedDbSupersededError } from '@core/_shared/infrastructure/IndexedDbSupersededError';
import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';

/**
 * Recognises a page whose code is older than the browser database it
 * keeps its data in: a newer version of the app upgraded the database
 * after this page loaded, or had already upgraded it when this page
 * first asked for it. Nothing retried from this page can work, and
 * loading the page again does, because that runs the newer code.
 *
 * Matches the database client's own error, and the browser's raw
 * `VersionError` for a request that did not go through the client.
 * The `cause` chain is followed, so the condition stays recognisable
 * after an operation has wrapped it in an error of its own.
 */
export class PageOutdatedFailureReasonRule implements FailureReasonRule {

  private static readonly OUTDATED_ERROR_NAMES: readonly string[] = [
    IndexedDbSupersededError.ERROR_NAME,
    'VersionError',
  ];

  private static readonly MAX_CAUSE_DEPTH = 8;

  readonly reason: FailureReason = 'page-outdated';

  matches(error: unknown): boolean {
    let candidate = error;
    for (let depth = 0; depth < PageOutdatedFailureReasonRule.MAX_CAUSE_DEPTH; depth += 1) {
      if (typeof candidate !== 'object' || candidate === null) return false;
      const name = (candidate as { name?: unknown }).name;
      if (typeof name === 'string' && PageOutdatedFailureReasonRule.OUTDATED_ERROR_NAMES.includes(name)) {
        return true;
      }
      candidate = (candidate as { cause?: unknown }).cause;
    }
    return false;
  }
}
