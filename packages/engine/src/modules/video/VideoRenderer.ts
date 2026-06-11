import type { RenderJob, RenderResult, RenderProgress } from '@modules/video/RenderJob';

export interface VideoRenderer {
  render(
    job: RenderJob,
    onProgress?: (progress: RenderProgress) => void,
  ): Promise<RenderResult>;
}
