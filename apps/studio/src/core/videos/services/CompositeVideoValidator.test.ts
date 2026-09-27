import { describe, expect, it } from 'vitest';
import type { VideoCandidate } from '@core/videos/domain/VideoCandidate';
import type { VideoValidationResult } from '@core/videos/domain/VideoValidationResult';
import type { VideoValidator } from '@core/videos/domain/VideoValidator';
import { CompositeVideoValidator } from '@core/videos/services/CompositeVideoValidator';

/** A rule with a fixed answer that records whether it was asked. */
class StubValidator implements VideoValidator {
  asked = false;

  constructor(private readonly result: VideoValidationResult) {}

  validate(): Promise<VideoValidationResult> {
    this.asked = true;
    return Promise.resolve(this.result);
  }
}

/** A rule whose source cannot be read. */
class UnreachableValidator implements VideoValidator {
  validate(): Promise<VideoValidationResult> {
    return Promise.reject(new Error('source unreachable'));
  }
}

const CANDIDATE: VideoCandidate = { durationSeconds: 30, isSourceReadable: true };

const ACCEPTED: VideoValidationResult = { state: 'accepted' };
const UNREADABLE: VideoValidationResult = {
  state: 'rejected',
  details: { type: 'unreadable', reason: 'container-unreadable' },
};
const OVER_CAP: VideoValidationResult = {
  state: 'rejected',
  details: { type: 'over-cap', capSeconds: 10, videoDurationSeconds: 30 },
};

describe('CompositeVideoValidator', () => {
  it('accepts only when every rule accepts', async () => {
    const validator = new CompositeVideoValidator([
      new StubValidator(ACCEPTED),
      new StubValidator(ACCEPTED),
    ]);

    await expect(validator.validate(CANDIDATE)).resolves.toEqual(ACCEPTED);
  });

  it('reports the first refusal in the order the rules were given', async () => {
    const validator = new CompositeVideoValidator([
      new StubValidator(UNREADABLE),
      new StubValidator(OVER_CAP),
    ]);

    await expect(validator.validate(CANDIDATE)).resolves.toEqual(UNREADABLE);
  });

  it('does not ask a later rule once one has refused', async () => {
    const later = new StubValidator(OVER_CAP);
    const validator = new CompositeVideoValidator([new StubValidator(UNREADABLE), later]);

    await validator.validate(CANDIDATE);

    expect(later.asked).toBe(false);
  });

  it('fails when a rule cannot be applied at all', async () => {
    const validator = new CompositeVideoValidator([
      new StubValidator(ACCEPTED),
      new UnreachableValidator(),
    ]);

    await expect(validator.validate(CANDIDATE)).rejects.toThrow('source unreachable');
  });

  it('refuses without reaching a rule whose source is unreachable', async () => {
    const validator = new CompositeVideoValidator([
      new StubValidator(UNREADABLE),
      new UnreachableValidator(),
    ]);

    await expect(validator.validate(CANDIDATE)).resolves.toEqual(UNREADABLE);
  });

  it('accepts a candidate no rule has anything to say about', async () => {
    await expect(new CompositeVideoValidator([]).validate(CANDIDATE)).resolves.toEqual(ACCEPTED);
  });
});
