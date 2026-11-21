import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';

/**
 * Whoever asked for a transcription, as a transcriber sees it: the
 * progress to report to, and the project the transcript belongs to,
 * `null` when the transcription belongs to no project.
 *
 * Handed in with every call: two transcriptions can run at once, and
 * each reports to its own progress and belongs to its own project,
 * whatever the editor shows by then.
 */
export interface TranscriptionRequester {
  readonly progress: PreprocessingProgressStore;
  readonly projectId: string | null;
}
