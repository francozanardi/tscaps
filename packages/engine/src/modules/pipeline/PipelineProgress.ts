import type { TranscriberProgressEvent } from '@modules/transcription/Transcriber';
import type { RenderProgress } from '@modules/video/RenderJob';

/**
 * One step of the render pipeline reporting status. `transcribing` and
 * `rendering` wrap the underlying stage event so listeners get the full
 * progress payload of the work being done; the structural steps in the
 * middle (`splitting`, tagging, effects) emit a `started`/`completed`
 * boundary because they finish in a single synchronous pass.
 */
export type PipelineProgressEvent =
  | { stage: 'transcribing'; inner: TranscriberProgressEvent }
  | { stage: 'splitting'; status: 'started' | 'completed' }
  | { stage: 'tagging-structural'; status: 'started' | 'completed' }
  | { stage: 'tagging-semantic'; status: 'started' | 'completed' }
  | { stage: 'applying-effects'; status: 'started' | 'completed' }
  | { stage: 'rendering'; inner: RenderProgress };

export type PipelineProgressListener = (event: PipelineProgressEvent) => void;
