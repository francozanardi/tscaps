import type { TranscriptionAudioLengthPolicy } from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import type { VideoCandidate } from '@core/videos/domain/VideoCandidate';
import type { VideoValidationResult } from '@core/videos/domain/VideoValidationResult';
import type { VideoValidator } from '@core/videos/domain/VideoValidator';

/**
 * Refuses a video longer than the transcription cap that applies to
 * the current visitor, resolving that cap on every call so the answer
 * follows a tier that moves mid-session.
 *
 * Give it only to flows about to transcribe. A flow that opens an
 * already-transcribed video must not have it: that video was accepted
 * under whatever cap applied when it was transcribed, and lowering a
 * tier's ceiling would otherwise refuse people projects they own.
 */
export class DurationVideoValidator implements VideoValidator {
  constructor(private readonly audioLengthPolicy: TranscriptionAudioLengthPolicy) {}

  async validate(candidate: VideoCandidate): Promise<VideoValidationResult> {
    const cap = await this.audioLengthPolicy.resolveCap();
    if (cap.state === 'no-cap') return { state: 'accepted' };
    if (candidate.durationSeconds <= cap.seconds) return { state: 'accepted' };
    return {
      state: 'rejected',
      details: {
        type: 'over-cap',
        capSeconds: cap.seconds,
        videoDurationSeconds: candidate.durationSeconds,
      },
    };
  }
}
