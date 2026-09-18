import { describe, expect, it } from 'vitest';
import { WorkerBoundaryError } from '@core/_shared/workers/WorkerBoundaryError';

/**
 * Sends a failure the way a worker does: flattened to plain data,
 * cloned the way `postMessage` clones it, and rebuilt on the far side.
 * The clone is part of the trip because a description that cannot
 * survive it never reaches the owner at all.
 */
function acrossTheBoundary(error: unknown, fallbackMessage = 'Job failed'): WorkerBoundaryError {
  return new WorkerBoundaryError(structuredClone(WorkerBoundaryError.describe(error, fallbackMessage)));
}

function causesOf(error: Error): string[] {
  const names: string[] = [];
  let link: unknown = error;
  while (link instanceof Error) {
    names.push(`${link.name}: ${link.message}`);
    link = (link as { cause?: unknown }).cause;
  }
  return names;
}

describe('WorkerBoundaryError', () => {
  it('carries the name and message of the failure it was given', () => {
    const arrived = acrossTheBoundary(new DOMException('out of room', 'QuotaExceededError'));

    expect(arrived.name).toBe('QuotaExceededError');
    expect(arrived.message).toBe('out of room');
  });

  it('describes a thrown value that is not an error with the fallback', () => {
    const arrived = acrossTheBoundary('something odd', 'Transcription failed');

    expect(arrived.name).toBe('Error');
    expect(arrived.message).toBe('Transcription failed');
  });

  /**
   * The outermost link says which operation failed. Everything under
   * it says why, which is the question a worker failure is usually
   * opened to answer.
   */
  it('carries the whole spine of wrappers', () => {
    const wrapped = new Error('Model load failed', {
      cause: new Error('Could not reach the host', {
        cause: new TypeError('Failed to fetch'),
      }),
    });

    expect(causesOf(acrossTheBoundary(wrapped))).toEqual([
      'Error: Model load failed',
      'Error: Could not reach the host',
      'TypeError: Failed to fetch',
    ]);
  });

  it('carries the siblings of a step that tried several strategies', () => {
    const attempts = new AggregateError(
      [new DOMException('no decoder for aac', 'NotSupportedError'), new Error('the remux failed')],
      'No audio decode path succeeded',
    );

    const arrived = acrossTheBoundary(new Error('Audio extraction failed', { cause: attempts }));

    const branches = ((arrived as { cause?: unknown }).cause as WorkerBoundaryError).errors ?? [];
    expect(branches.map((branch) => `${branch.name}: ${branch.message}`)).toEqual([
      'NotSupportedError: no decoder for aac',
      'Error: the remux failed',
    ]);
  });

  it('terminates on a chain that points back into itself', () => {
    const outer = new Error('outer');
    const inner = new Error('inner', { cause: outer });
    (outer as { cause?: unknown }).cause = inner;

    expect(causesOf(acrossTheBoundary(outer))).toEqual(['Error: outer', 'Error: inner']);
  });

  it('stops descending a chain longer than it will carry', () => {
    let deepest = new Error('link 0');
    for (let depth = 1; depth < 20; depth += 1) {
      deepest = new Error(`link ${depth}`, { cause: deepest });
    }

    expect(causesOf(acrossTheBoundary(deepest))).toHaveLength(8);
  });
});
