import { describe, expect, it } from 'vitest';
import { NotFoundFailureReasonRule } from '@core/errors/services/failure-reasons/NotFoundFailureReasonRule';
import { ProjectNotFoundError } from '@core/projects/domain/errors/ProjectNotFoundError';
import { ProjectOpenFailedError } from '@core/projects/domain/errors/ProjectOpenFailedError';

const rule = new NotFoundFailureReasonRule();

describe('NotFoundFailureReasonRule', () => {
  it('recognises the error itself', () => {
    expect(rule.matches(new ProjectNotFoundError('a-project'))).toBe(true);
  });

  /**
   * The path every reader takes: the condition is only ever read off
   * the operation error the rendering boundary was handed.
   */
  it('recognises it under the operation that wrapped it', () => {
    const wrapped = new ProjectOpenFailedError({ cause: new ProjectNotFoundError('a-project') });

    expect(rule.matches(wrapped)).toBe(true);
  });

  it('does not recognise a project that exists but would not load', () => {
    const wrapped = new ProjectOpenFailedError({
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
