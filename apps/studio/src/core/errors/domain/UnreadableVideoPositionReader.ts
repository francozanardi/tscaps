/**
 * Finds where a video stopped being readable, when that is what a
 * failure comes down to: the second up to which its frames decoded
 * before one could not be. That is where the file is most likely
 * damaged.
 */
export interface UnreadableVideoPositionReader {
  /**
   * The second the video was readable up to, or `null` when the failure
   * is not a decode that stopped partway. A video refused from its first
   * frame also answers `null`: it says nothing about damage at a point.
   */
  positionIn(error: unknown): number | null;
}
