/** The part of a video track a frame rate is read from. */
export interface FrameRateTrack {
  computePacketStats(targetPacketCount?: number): Promise<{ averagePacketRate: number }>;
}

/** The rate assumed for a track whose packets give none. */
const DEFAULT_FRAME_RATE = 30;

/** How many packets the average is taken over. */
const SAMPLED_PACKETS = 120;

/**
 * The frame rate a render takes its source at: the average packet rate
 * over the track's first packets, or 30 where that cannot be read.
 * Everything timed off the source's rate within a render, such as how
 * often its captions step, follows this one answer.
 */
export class SourceFrameRateReader {

  async read(track: FrameRateTrack): Promise<number> {
    try {
      const stats = await track.computePacketStats(SAMPLED_PACKETS);
      if (Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0) {
        return stats.averagePacketRate;
      }
    } catch {
      // Falls through to the default.
    }
    console.warn(`Could not determine input frame rate; defaulting to ${DEFAULT_FRAME_RATE} fps`);
    return DEFAULT_FRAME_RATE;
  }
}
