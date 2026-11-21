import type { PicturePoint } from '@core/reframe/domain/PicturePoint';
import type { VideoTake } from '@core/reframe/domain/VideoTake';

/**
 * A person found in a take. `letter` names them among the take's people,
 * A, B, C… from the left of the picture to its right at the moment the
 * take is pictured; `at` is where their head is at that moment, `head`
 * the middle of where it was through the take, and `fromX` to `toX` how
 * far across the picture it went. `headHeight` is how tall the head is,
 * crown to chin, as a share of the picture's height; null where it could
 * not be told. Points are shares of the source picture.
 */
export interface SurveyedPerson {
  readonly letter: string;
  readonly at: PicturePoint;
  readonly head: PicturePoint;
  readonly headHeight: number | null;
  readonly fromX: number;
  readonly toX: number;
}

/**
 * Who is in a take: the people found in it, from left to right, and the
 * moment of the source video they are lettered at, which is the moment
 * the take is pictured.
 */
export interface TakeSurvey {
  readonly take: VideoTake;
  readonly pictureSec: number;
  readonly people: ReadonlyArray<SurveyedPerson>;
}
