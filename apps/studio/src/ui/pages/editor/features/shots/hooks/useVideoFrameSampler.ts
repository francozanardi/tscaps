import { useEffect, useMemo } from 'react';
import { VideoFrameSampler } from '@presentation/shots/services/VideoFrameSampler';

/** A frame sampler for the caller's lifetime, disposed when it unmounts. */
export function useVideoFrameSampler(): VideoFrameSampler {
  const sampler = useMemo(() => new VideoFrameSampler(), []);
  useEffect(() => () => sampler.dispose(), [sampler]);
  return sampler;
}
