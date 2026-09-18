import { describe, expect, it } from 'vitest';
import { ModelFileRequestFailedError } from '@tscaps/engine';
import { NetworkUnreachableFailureReasonRule } from '@core/errors/services/failure-reasons/NetworkUnreachableFailureReasonRule';

const rule = new NetworkUnreachableFailureReasonRule();

function unreachable(message: string): ModelFileRequestFailedError {
  return new ModelFileRequestFailedError(message, { cause: new TypeError('Failed to fetch') });
}

describe('NetworkUnreachableFailureReasonRule', () => {
  it('recognises a request that never reached its host', () => {
    expect(rule.matches(unreachable('Could not reach https://models.example/config.json.'))).toBe(true);
  });

  it('recognises it under every operation that wrapped it', () => {
    const wrapped = new Error('Local transcription failed', {
      cause: new Error('Whisper pipeline could not be loaded.', {
        cause: unreachable('Could not reach https://models.example/config.json.'),
      }),
    });

    expect(rule.matches(wrapped)).toBe(true);
  });

  it('recognises it when more than one route was tried and all of them failed', () => {
    const attempts = new AggregateError(
      [unreachable('Could not reach the host.'), unreachable('Could not reach the relay.')],
      'Both model file routes failed.',
    );

    expect(rule.matches(new Error('Local transcription failed', { cause: attempts }))).toBe(true);
  });

  /**
   * The browser rejects an unreachable request with a bare `TypeError`
   * on every engine, which is what a programming fault also produces.
   * Only an operation that has already decided a rejection was about
   * the transport names the condition, so the raw rejection must not
   * be read as one.
   */
  it('does not read the browser rejection on its own as this condition', () => {
    expect(rule.matches(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('does not recognise a failure that was not about reaching a host', () => {
    const wrapped = new Error('Local transcription failed', {
      cause: new DOMException('out of room', 'QuotaExceededError'),
    });

    expect(rule.matches(wrapped)).toBe(false);
  });
});
