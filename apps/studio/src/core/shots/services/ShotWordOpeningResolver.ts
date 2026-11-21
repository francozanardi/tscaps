import type { Word } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import type { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';

/**
 * Where a shot opening on a given word opens: inside the silence before
 * that word, placed the way a proposed shot is — on a picture change the
 * video already carries there, or with a margin either side otherwise.
 *
 * Words are the Original track's, whatever caption track is active:
 * shots are cut at what is said in the video.
 */
export class ShotWordOpeningResolver {
  constructor(
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly pictureChangeLocator: PictureChangeLocator,
    private readonly openingPlacer: ShotOpeningPlacer,
  ) {}

  /**
   * The source time a shot opening on `wordId` opens at; the word's own
   * start where nothing is said before it; `null` where no such word is
   * said in the video.
   */
  openingBefore(state: EditorState, wordId: string): number | null {
    const words = this.wordsInTimeOrder(state);
    const index = words.findIndex((word) => word.id === wordId);
    if (index < 0) return null;
    const word = words[index]!;
    const previous = words[index - 1];
    if (!previous) return word.time.start;
    const gapStartSec = Math.min(previous.time.end, word.time.start);
    return this.openingPlacer.place({
      gapStartSec,
      timeSec: word.time.start,
      pictureChangeSec: this.pictureChangeLocator.within(
        state.video.pictureChangesSec ?? [],
        gapStartSec,
        word.time.start,
      ),
    });
  }

  private wordsInTimeOrder(state: EditorState): Word[] {
    const { document } = this.originalCaptions.read(state);
    if (!document) return [];
    return document.sections
      .flatMap((section) => section.segments.flatMap((segment) => segment.getWords()))
      .sort((a, b) => a.time.start - b.time.start);
  }
}
