import type { VideoCandidate } from '@core/videos/domain/VideoCandidate';
import type { VideoValidationResult } from '@core/videos/domain/VideoValidationResult';

/**
 * One rule about whether a video may be preprocessed, applied only
 * when a caller asks. Implementations load whatever source their rule
 * needs, and reject — carrying its cause — when they cannot read it:
 * a rule that could not be applied is not a rule that passed.
 */
export interface VideoValidator {
  validate(candidate: VideoCandidate): Promise<VideoValidationResult>;
}
