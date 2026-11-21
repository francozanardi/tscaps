import { describe, expect, it } from 'vitest';
import { IndexedDbSupersededError } from '@core/_shared/infrastructure/IndexedDbSupersededError';
import { PageOutdatedFailureReasonRule } from '@core/errors/services/failure-reasons/PageOutdatedFailureReasonRule';
import { ProjectOpenFailedError } from '@core/projects/domain/errors/ProjectOpenFailedError';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';

const rule = new PageOutdatedFailureReasonRule();

describe('PageOutdatedFailureReasonRule', () => {
  /**
   * The path every reader takes: the condition is only ever read off
   * the operation error the rendering boundary was handed.
   */
  it('recognises a save refused because a newer version took the database', () => {
    const wrapped = new ProjectSaveFailedError({ cause: new IndexedDbSupersededError('tscaps', 14) });

    expect(rule.matches(wrapped)).toBe(true);
  });

  it("recognises the browser's own refusal of a database newer than the page", () => {
    const wrapped = new ProjectOpenFailedError({
      cause: new DOMException('The requested version (9) is less than the existing version (14).', 'VersionError'),
    });

    expect(rule.matches(wrapped)).toBe(true);
  });

  it('does not recognise a save the device had no room for', () => {
    const wrapped = new ProjectSaveFailedError({
      cause: new DOMException('the device is out of space', 'QuotaExceededError'),
    });

    expect(rule.matches(wrapped)).toBe(false);
  });

  it('survives a cause that points back into the chain', () => {
    const outer: { name: string; cause?: unknown } = { name: 'OuterError' };
    outer.cause = outer;

    expect(rule.matches(outer)).toBe(false);
  });
});
