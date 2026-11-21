import type { FramedPart } from '@core/reframe/domain/FramingPart';
import type { SurveyedPerson, TakeSurvey } from '@core/reframe/domain/TakeSurvey';
import type { SurveyReframeReport } from '@core/reframe/services/SurveyReframeWorkflow';
import type { TakeSpeech } from '@core/reframe/services/TakeSpeech';

/**
 * A surveyed reframe as whoever asked for it reads it: the survey to
 * choose from (each take with its stretch, the people found in it and
 * what is said in it, phrase by phrase), or what the reframe did (each
 * part with its take, its stretch, what it shows, its shots and its
 * framing, and the problems found). Times and points are rounded to
 * hundredths. The pictures are not in it: they go beside it.
 */
export class SurveyReframeReadout {
  constructor(private readonly speech: TakeSpeech) {}

  /** The survey, for choosing what each take shows, with what `warnings` say about it. */
  survey(surveys: ReadonlyArray<TakeSurvey>, warnings: ReadonlyArray<string>): Record<string, unknown> {
    return {
      ok: true,
      framed: false,
      ...(warnings.length > 0 ? { problems: warnings } : {}),
      takes: surveys.map((survey) => ({
        take: survey.take.index,
        fromSec: this.rounded(survey.take.startSec),
        toSec: this.rounded(survey.take.endSec),
        people: survey.people.map((person) => this.personOf(person)),
        said: this.speech.phrases(survey.take.startSec, survey.take.endSec).map((phrase) => [this.rounded(phrase.startSec), ...(phrase.speaker === null ? [] : [phrase.speaker]), phrase.text]),
      })),
    };
  }

  /** What the reframe did. */
  report(report: SurveyReframeReport): Record<string, unknown> {
    return {
      ok: true,
      framed: true,
      frame: report.frame,
      parts: report.parts.map((part, index) => this.partOf(part, index)),
      ...(report.warnings.length > 0 ? { problems: report.warnings } : {}),
    };
  }

  private personOf(person: SurveyedPerson): Record<string, unknown> {
    return { person: person.letter, x: this.rounded(person.at.x), y: this.rounded(person.at.y) };
  }

  private partOf(part: FramedPart, index: number): Record<string, unknown> {
    return {
      part: index + 1,
      take: part.take,
      fromSec: this.rounded(part.startSec),
      toSec: this.rounded(part.endSec),
      shows: part.subject.name,
      shots: part.shots,
      framing: { x: this.rounded(part.framing.x), ...(part.framing.y === null ? {} : { y: this.rounded(part.framing.y) }), scale: part.framing.scale },
      ...(part.follows ? { follows: true } : {}),
    };
  }

  private rounded(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
