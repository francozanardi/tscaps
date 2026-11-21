import { describe, expect, it } from 'vitest';
import type {
  PreprocessingProgressPhase,
  PreprocessingProgressStatus,
} from '@core/preprocessing/domain/PreprocessingProgressStatus';
import { ProjectInProgressLabel } from '@presentation/projects/services/ProjectInProgressLabel';

/**
 * A card says what the run working on its project is doing, in the
 * same stages the loading screen goes through, so a reader who left the
 * loading screen still sees where their video is.
 */

function status(phase: PreprocessingProgressPhase | null, rawProgress = 0): PreprocessingProgressStatus {
  return { active: phase !== null, initialPhase: phase, phase, rawProgress };
}

describe('ProjectInProgressLabel', () => {
  const label = new ProjectInProgressLabel();

  it('names each stage, with how far it is once it reports any', () => {
    expect(label.of(status('queued'))).toBe('Waiting');
    expect(label.of(status('converting', 0.25))).toBe('Converting 25%');
    expect(label.of(status('audio-extract', 0.5))).toBe('Extracting audio 50%');
    expect(label.of(status('model-download', 0.333))).toBe('Downloading model 33%');
    expect(label.of(status('inferring', 0.42))).toBe('Transcribing 42%');
    expect(label.of(status('preview-proxy', 0.9))).toBe('Preparing preview 90%');
  });

  it('leaves the percent out of a stage that has not reported any yet', () => {
    expect(label.of(status('inferring'))).toBe('Transcribing');
  });

  it('says the project is saving once the stages are over or the run gave them up', () => {
    expect(label.of(status('complete', 1))).toBe('Saving');
    expect(label.of(status(null))).toBe('Saving');
  });
});
