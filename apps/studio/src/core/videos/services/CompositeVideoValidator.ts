import type { VideoCandidate } from '@core/videos/domain/VideoCandidate';
import type { VideoValidationResult } from '@core/videos/domain/VideoValidationResult';
import type { VideoValidator } from '@core/videos/domain/VideoValidator';

/**
 * Runs rules in order and answers with the first refusal, accepting
 * only when every rule does. Later rules are not asked once one has
 * refused, so callers order them by which refusal a visitor should
 * read first.
 */
export class CompositeVideoValidator implements VideoValidator {
  constructor(private readonly validators: ReadonlyArray<VideoValidator>) {}

  async validate(candidate: VideoCandidate): Promise<VideoValidationResult> {
    for (const validator of this.validators) {
      const result = await validator.validate(candidate);
      if (result.state === 'rejected') return result;
    }
    return { state: 'accepted' };
  }
}
