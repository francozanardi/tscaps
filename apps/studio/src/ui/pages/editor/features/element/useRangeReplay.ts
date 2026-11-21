import { useCallback } from 'react';
import { useRangeReplayController } from '@ui/pages/editor/features/element/useRangeReplayController';

/**
 * Plays one stretch of the video once, silently unless asked for its
 * sound, stopping exactly at
 * its end, and does nothing at all while the user is playing the video
 * themselves. Nothing is left running when the caller goes away: the
 * stop is the surface's, not a timer's.
 */
export function useRangeReplay(): (startSec: number, endSec: number, withSound?: boolean) => void {
  const controller = useRangeReplayController();
  return useCallback(
    (startSec: number, endSec: number, withSound?: boolean) => controller.replay(startSec, endSec, withSound),
    [controller],
  );
}
