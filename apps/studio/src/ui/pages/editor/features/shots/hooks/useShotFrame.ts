import { useEffect, useState } from 'react';
import type { VideoFrameSampler } from '@presentation/shots/services/VideoFrameSampler';

// A frame that comes within this long is shown without a word: a spinner that flashes for less reads as a glitch.
const READING_SAID_AFTER_MS = 150;

/** A frame of a video, and whether a newer one is being read. */
export interface ShotFrame {
  /** The last frame taken, as a URL, kept on screen while the next is read; null until the first and while there is no source. */
  readonly picture: string | null;
  /** The frame asked for has not come yet, and has been read for long enough to say so. */
  readonly reading: boolean;
}

/**
 * The frame of `source` at `seconds`, keeping the last one until the
 * next is taken. A frame that cannot be read leaves the picture as it
 * was rather than raising: the panel reads perfectly well without it,
 * and the video beside it already says something is wrong with the file.
 */
export function useShotFrame(sampler: VideoFrameSampler, source: Blob | null, seconds: number): ShotFrame {
  const [picture, setPicture] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    if (!source) {
      setPicture(null);
      return;
    }
    let current = true;
    const saying = setTimeout(() => { if (current) setReading(true); }, READING_SAID_AFTER_MS);
    const settle = (frame: string | null) => {
      clearTimeout(saying);
      if (!current) return;
      if (frame !== null) setPicture(frame);
      setReading(false);
    };
    sampler.frameAt(source, seconds).then(settle, () => settle(null));
    return () => {
      current = false;
      clearTimeout(saying);
    };
  }, [sampler, source, seconds]);
  return { picture, reading };
}
