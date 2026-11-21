import type { VideoFrameSampler } from '@presentation/shots/services/VideoFrameSampler';
import { useShotFrame } from '@ui/pages/editor/features/shots/hooks/useShotFrame';

/**
 * The frame of `source` at `seconds`, or null until it has been taken
 * and while there is no source; the last one taken while another is
 * read (`useShotFrame`).
 */
export function useShotPoster(sampler: VideoFrameSampler, source: Blob | null, seconds: number): string | null {
  return useShotFrame(sampler, source, seconds).picture;
}
