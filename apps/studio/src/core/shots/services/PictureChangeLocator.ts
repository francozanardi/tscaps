/**
 * Finds the picture change that stands in a silence between two words:
 * the source's own edit, or a switch of camera, a new shot opening there
 * should land on.
 *
 * A change a frame or two outside the silence still counts. Word times
 * are aligned to the audio within a few hundredths, so a change just
 * past a word's start is the video's edit, and the word's time the one
 * that is off. The reach is kept under the share of a word that would
 * move one of its letters to the other shot.
 */
export class PictureChangeLocator {
  private static readonly TOLERANCE_SEC = 0.05;

  /**
   * The picture change between `fromSec` and `toSec`, the latest where
   * several are: the one nearest the words the new shot opens on. `null`
   * where there is none. `pictureChangesSec` must be ascending.
   */
  within(pictureChangesSec: ReadonlyArray<number>, fromSec: number, toSec: number): number | null {
    const tolerance = PictureChangeLocator.TOLERANCE_SEC;
    let found: number | null = null;
    for (const changeSec of pictureChangesSec) {
      if (changeSec > toSec + tolerance) break;
      if (changeSec >= fromSec - tolerance) found = changeSec;
    }
    return found;
  }
}
