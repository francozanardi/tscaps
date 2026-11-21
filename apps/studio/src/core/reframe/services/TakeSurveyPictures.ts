import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { SourceVideoPictures } from '@core/reframe/domain/SourceVideoPictures';
import type { MarkedPicture, SurveySheetComposer } from '@core/reframe/domain/SurveySheetComposer';
import type { TakeSurvey } from '@core/reframe/domain/TakeSurvey';

// Takes shown per picture: four rows of four stay readable at the size a model reads a picture.
const TAKES_PER_SHEET = 16;
const SHEET_COLUMNS = 4;
const CELL_WIDTH_PX = 360;
// The box drawn on a head whose size could not be told, as a share of the picture's height.
const UNKNOWN_HEAD_HEIGHT = 0.12;

/**
 * Pictures of a survey for whoever chooses what each take shows: the
 * source's own picture of every take at the moment its people were
 * lettered, numbered as the takes are, each person boxed with their
 * letter.
 */
export class TakeSurveyPictures {
  constructor(
    private readonly pictures: SourceVideoPictures,
    private readonly sheets: SurveySheetComposer,
  ) {}

  /** The pictures of `surveys`, a few takes on each; none where no picture could be read. */
  async of(surveys: ReadonlyArray<TakeSurvey>, signal: AbortSignal): Promise<EncodedPicture[]> {
    if (surveys.length === 0) return [];
    const read = await this.pictures.pictureAt(surveys.map((survey) => survey.pictureSec), signal);
    try {
      const marked: MarkedPicture[] = [];
      for (const survey of surveys) {
        const frame = read.frames.find((each) => each.sourceSec === survey.pictureSec);
        if (frame === undefined) continue;
        marked.push({
          bitmap: frame.bitmap,
          label: `Take ${survey.take.index}`,
          marks: survey.people.map((person) => ({ letter: person.letter, head: person.at, headHeight: person.headHeight ?? UNKNOWN_HEAD_HEIGHT })),
        });
      }
      const sheets: EncodedPicture[] = [];
      for (let from = 0; from < marked.length; from += TAKES_PER_SHEET) {
        sheets.push(await this.sheets.survey(marked.slice(from, from + TAKES_PER_SHEET), SHEET_COLUMNS, CELL_WIDTH_PX));
      }
      return sheets;
    } finally {
      for (const frame of read.frames) frame.bitmap.close();
    }
  }
}
