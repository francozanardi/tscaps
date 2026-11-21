import type { ProjectFramePictures } from '@core/export/domain/ProjectFramePictures';
import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { FramedPart } from '@core/reframe/domain/FramingPart';
import type { FramingSheetComposer, LabelledPicture } from '@core/reframe/domain/FramingSheetComposer';
import type { PartMoments } from '@core/reframe/services/PartMoments';

const LETTERS = ['a', 'b', 'c'];
// Frames shown per picture, in one row or two of tall frames.
const FRAMES_PER_SHEET = 14;
const SHEET_COLUMNS = 7;
const CELL_WIDTH_PX = 190;

/**
 * Pictures of the reframed video as it will be exported: a frame from
 * the middle of each part, or its start, middle and end for a part whose
 * camera follows its person, since a move can lose them anywhere.
 */
export class FramedPartPictures {
  constructor(
    private readonly frames: ProjectFramePictures,
    private readonly sheets: FramingSheetComposer,
    private readonly moments: PartMoments,
  ) {}

  /**
   * Pictures of `parts` as they export, numbered from 1 in order: a frame
   * from the middle of each, or its start, middle and end lettered `a` to
   * `c` where its camera follows its person; none where nothing could be
   * drawn.
   */
  async of(parts: ReadonlyArray<FramedPart>, signal: AbortSignal): Promise<EncodedPicture[]> {
    if (parts.length === 0) return [];
    const moments = parts.map((part) => this.momentsOf(part));
    const rendered = await this.frames.renderAt([...new Set(moments.flat())], signal);
    try {
      const labelled: LabelledPicture[] = [];
      parts.forEach((_, index) => {
        const ofPart = moments[index]!;
        ofPart.forEach((sec, at) => {
          const frame = rendered.frames.find((each) => each.sourceSec === sec);
          if (frame !== undefined) labelled.push({ bitmap: frame.bitmap, label: ofPart.length === 1 ? `${index + 1}` : `${index + 1}${LETTERS[at]}` });
        });
      });
      const sheets: EncodedPicture[] = [];
      for (let from = 0; from < labelled.length; from += FRAMES_PER_SHEET) {
        sheets.push(await this.sheets.grid(labelled.slice(from, from + FRAMES_PER_SHEET), SHEET_COLUMNS, CELL_WIDTH_PX));
      }
      return sheets;
    } finally {
      for (const frame of rendered.frames) frame.bitmap.close();
    }
  }

  /** The moments a part is looked at: its middle, or its start, middle and end where its camera follows its person. */
  private momentsOf(part: FramedPart): number[] {
    const moments = this.moments.of(part.startSec, part.endSec);
    return part.follows ? moments : [moments[Math.floor(moments.length / 2)]!];
  }
}
