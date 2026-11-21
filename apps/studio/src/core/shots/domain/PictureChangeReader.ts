/**
 * Finds where the source video's own picture changes abruptly: an edit
 * already in it, a switch of camera. Answers source times, ascending,
 * each the first frame of the new picture. Throws where no video is
 * loaded.
 */
export interface PictureChangeReader {
  /**
   * @param onProgress Told how far through the video the search is,
   *   from 0 to 1, while it has to look; never called when the answer
   *   is already known.
   */
  read(onProgress?: (fraction: number) => void): Promise<ReadonlyArray<number>>;
}
