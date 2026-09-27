import type {
  TranscriptionAudioLengthCap,
  TranscriptionAudioLengthPolicy,
} from '@core/transcription/domain/TranscriptionAudioLengthPolicy';

const NO_CAP: TranscriptionAudioLengthCap = { state: 'no-cap' };

/**
 * `TranscriptionAudioLengthPolicy` that never applies a cap. Used on
 * surfaces where transcription runs locally in the browser and no
 * per-request duration limit is enforced.
 */
export class NoOpTranscriptionAudioLengthPolicy implements TranscriptionAudioLengthPolicy {
  resolveCap(): Promise<TranscriptionAudioLengthCap> {
    return Promise.resolve(NO_CAP);
  }
}
