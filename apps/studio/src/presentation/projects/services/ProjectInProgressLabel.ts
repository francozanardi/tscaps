import type { PreprocessingProgressStatus } from '@core/preprocessing/domain/PreprocessingProgressStatus';

/**
 * Names, for a project's card, what the run working on it is doing: the
 * stage its progress is in, with how far that stage is once it reports
 * any, or `Saving` when the stages are over and only the project's save
 * is left.
 */
export class ProjectInProgressLabel {
  of(progress: PreprocessingProgressStatus): string {
    switch (progress.phase) {
      case 'queued': return 'Waiting';
      case 'converting': return this.withPercent('Converting', progress.rawProgress);
      case 'audio-extract': return this.withPercent('Extracting audio', progress.rawProgress);
      case 'model-download': return this.withPercent('Downloading model', progress.rawProgress);
      case 'inferring': return this.withPercent('Transcribing', progress.rawProgress);
      case 'preview-proxy': return this.withPercent('Preparing preview', progress.rawProgress);
      case 'complete':
      case null: return 'Saving';
    }
  }

  private withPercent(stage: string, rawProgress: number): string {
    const percent = Math.round(rawProgress * 100);
    return percent > 0 ? `${stage} ${percent}%` : stage;
  }
}
