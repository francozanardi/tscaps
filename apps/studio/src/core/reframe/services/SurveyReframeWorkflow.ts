import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { OutputFrameFormat } from '@core/output-frame/domain/OutputFrame';
import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { FramingDecision } from '@core/reframe/domain/FramingDecision';
import type { FramedPart, FramingPart } from '@core/reframe/domain/FramingPart';
import type { PartFollower, PartFollowOutcome } from '@core/reframe/domain/PartFollower';
import type { ReframeRun } from '@core/reframe/domain/ReframeRun';
import type { FramingChoice, TakeChoice } from '@core/reframe/domain/TakeChoice';
import type { TakeContent } from '@core/reframe/domain/TakePlan';
import type { SurveyedPerson, TakeSurvey } from '@core/reframe/domain/TakeSurvey';
import type { VideoTake } from '@core/reframe/domain/VideoTake';
import type { FramedPartPictures } from '@core/reframe/services/FramedPartPictures';
import type { FramedPartWriter } from '@core/reframe/services/FramedPartWriter';
import { FramingGeometry } from '@core/reframe/services/FramingGeometry';
import type { SurveyFraming } from '@core/reframe/services/SurveyFraming';
import type { TakeSpeech } from '@core/reframe/services/TakeSpeech';
import type { TakeSurveyPictures } from '@core/reframe/services/TakeSurveyPictures';
import type { TakeSurveyor } from '@core/reframe/services/TakeSurveyor';
import type { VideoTakes } from '@core/reframe/services/VideoTakes';
import type { ShotPictureArea } from '@core/shots/services/ShotPictureArea';

/**
 * What to reframe: the new shape, and what the takes show where someone
 * chose (null to frame by the survey alone). `onlyChosen` frames the
 * takes the choices name and leaves every other as it is. `surveyFirst`,
 * with no choices, answers the survey to choose from even where the
 * survey alone could frame every take.
 */
export interface SurveyReframeRequest {
  readonly format: OutputFrameFormat;
  readonly choices: ReadonlyArray<TakeChoice> | null;
  readonly onlyChosen: boolean;
  readonly surveyFirst?: boolean;
}

/**
 * What a surveyed reframe did: the frame as set, every part framed (the
 * shots it was written on as editor refs), what the person should know,
 * and pictures of the result as it exports, one per part as numbered.
 */
export interface SurveyReframeReport {
  readonly frame: unknown;
  readonly parts: ReadonlyArray<FramedPart>;
  readonly warnings: ReadonlyArray<string>;
  readonly sheets: ReadonlyArray<EncodedPicture>;
}

/**
 * How a surveyed reframe ended. `choose`: nobody said what the takes
 * show and the survey cannot say it alone (a take holds several people,
 * or the people could not be looked at, which `warnings` says), so
 * nothing was changed; the survey and its pictures are what to choose
 * from. `framed`: the video is reframed. `failed`: nothing was changed,
 * for the problems given.
 */
export type SurveyReframeOutcome =
  | { readonly kind: 'choose'; readonly surveys: ReadonlyArray<TakeSurvey>; readonly sheets: ReadonlyArray<EncodedPicture>; readonly warnings: ReadonlyArray<string> }
  | { readonly kind: 'framed'; readonly report: SurveyReframeReport }
  | { readonly kind: 'failed'; readonly problems: ReadonlyArray<string> };

/** A part to frame, with the survey of its take and the choice it is framed by. */
interface PlannedPart {
  readonly part: FramingPart;
  readonly survey: TakeSurvey;
  readonly choice: FramingChoice;
}

// A switch of subject this near a take's edge, or another switch, would leave a part too short to watch.
const MIN_PART_SEC = 1;
// A shot opening this little before a word already cuts in the silence before it.
const SWITCH_SILENCE_SEC = 0.6;
// A switch lands on the start of a word said this near the moment asked; further than that, on the moment itself.
const SWITCH_WORD_REACH_SEC = 1.5;
// Where a framing names no point down the picture, it looks at the middle.
const CENTRED = 0.5;
const FIXED: PartFollowOutcome = { kind: 'fixed' };
const SEARCHING_CAMERA_CHANGES = 'Finding the camera changes';
const LOOKING_FOR_PEOPLE = 'Finding the people in each take';
const FRAMING = 'Framing each take';
const NOT_LOOKED_AT = 'The people in the video could not be looked at on this device, so nobody is marked in any take: a take is framed on the middle of the picture unless a point is given for it.';
const RELAID_CAPTIONS = 'The frame changed size, so the captions were laid out again: read the transcript again before using segment or line refs; word refs still hold.';

/**
 * Reframes the video for an output frame of another shape, filled, from
 * a survey of who is in each take: it finds the takes and the people in
 * them, and frames each take by measure on the person it shows, closer
 * where they are small, following them where they move out of the
 * framing. Whom a take shows is the only thing it cannot measure: a take
 * with one person shows them and a take with nobody its middle, but a
 * take with several is a choice, and until that choice is given it
 * changes nothing and answers the survey to choose from; the same where
 * the people cannot be looked at on this device. A choice names
 * a person by the survey's letter, or a point of the picture, and may
 * switch to another inside the take, where a shot opens in the silence
 * before the nearest word. Every change joins the run's checkpoint.
 */
export class SurveyReframeWorkflow {
  constructor(
    private readonly runner: EditorOperationRunner,
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly area: ShotPictureArea,
    private readonly takes: VideoTakes,
    private readonly surveyor: TakeSurveyor,
    private readonly surveyPictures: TakeSurveyPictures,
    private readonly speech: TakeSpeech,
    private readonly framing: SurveyFraming,
    private readonly follower: PartFollower,
    private readonly writer: FramedPartWriter,
    private readonly partPictures: FramedPartPictures,
  ) {}

  /** Runs the reframe to its end, or to the choice it needs. Rejects with an `AbortError` once the run is stopped. */
  async run(request: SurveyReframeRequest, run: ReframeRun): Promise<SurveyReframeOutcome> {
    const takes = await this.takesOf(run);
    if (takes.length === 0) return { kind: 'failed', problems: ['The project has no video to frame.'] };
    const warnings: string[] = [];
    const surveys = await this.surveyed(takes, run, warnings);
    if (request.choices === null && (request.surveyFirst === true || warnings.length > 0 || surveys.some((survey) => survey.people.length > 1))) {
      return { kind: 'choose', surveys, sheets: await this.surveyPictures.of(surveys, run.signal), warnings };
    }
    const choices = request.choices ?? [];
    const problems = this.problemsWith(choices, surveys);
    if (problems.length > 0) return { kind: 'failed', problems };
    const sizeBefore = this.store.snapshot().frameLayout;
    const shape = await this.edit('set_output_frame', { format: request.format, fit: 'fill' }, run);
    if (!shape.ok) return { kind: 'failed', problems: shape.problems.map((problem) => problem.message) };
    if (this.resized(sizeBefore)) warnings.push(RELAID_CAPTIONS);
    const geometry = new FramingGeometry(this.area.spanOf(this.store.snapshot()));
    if (geometry.croppedAxis() === null) {
      return { kind: 'framed', report: { frame: shape.output, parts: [], warnings: [...warnings, 'The frame shows the whole picture, so there is nothing to frame.'], sheets: [] } };
    }
    await this.edit('split_shots', { atCameraChanges: true }, run);
    const wanted = request.onlyChosen ? surveys.filter((survey) => choices.some((choice) => choice.take === survey.take.index)) : surveys;
    const planned = await this.plannedOf(wanted, choices, run, warnings);
    const framed = await this.framedAll(planned, geometry, run, warnings);
    return { kind: 'framed', report: { frame: shape.output, parts: framed, warnings, sheets: await this.partPictures.of(framed, run.signal) } };
  }

  /** The video's takes, saying how far the search for its camera changes is, once per hundredth. */
  private async takesOf(run: ReframeRun): Promise<VideoTake[]> {
    run.progress.report({ label: SEARCHING_CAMERA_CHANGES });
    let hundredths = 0;
    return this.takes.read((fraction) => {
      const reached = Math.floor(fraction * 100);
      if (reached <= hundredths) return;
      hundredths = reached;
      run.progress.report({ label: SEARCHING_CAMERA_CHANGES, fraction });
    });
  }

  /** Who is in each take; where the people cannot be looked at on this device, nobody in any, with a warning. */
  private async surveyed(takes: ReadonlyArray<VideoTake>, run: ReframeRun, warnings: string[]): Promise<TakeSurvey[]> {
    run.progress.report({ label: LOOKING_FOR_PEOPLE });
    try {
      return await this.surveyor.survey(takes, run.signal, (fraction) => run.progress.report({ label: LOOKING_FOR_PEOPLE, fraction }));
    } catch (error) {
      if (run.signal.aborted) throw error;
      warnings.push(NOT_LOOKED_AT);
      return takes.map((take) => ({ take, pictureSec: Math.round(((take.startSec + take.endSec) / 2) * 100) / 100, people: [] }));
    }
  }

  /** What is wrong with `choices` against the survey: a take that is not there, a person nobody found. */
  private problemsWith(choices: ReadonlyArray<TakeChoice>, surveys: ReadonlyArray<TakeSurvey>): string[] {
    const problems: string[] = [];
    for (const choice of choices) {
      const survey = surveys.find((each) => each.take.index === choice.take);
      if (survey === undefined) {
        problems.push(`There is no take ${choice.take}: the takes are numbered 0 to ${surveys.length - 1}.`);
        continue;
      }
      for (const each of [choice, ...choice.switches]) {
        if (each.subject.kind === 'person' && this.personOf(survey, each.subject.letter) === null) {
          problems.push(`Take ${choice.take} has no person ${each.subject.letter}: ${this.peopleOf(survey)}. Give a point of the picture to show someone the survey did not find.`);
        }
      }
    }
    return problems;
  }

  private peopleOf(survey: TakeSurvey): string {
    return survey.people.length === 0 ? 'nobody was found in it' : `it has ${survey.people.map((person) => person.letter).join(', ')}`;
  }

  private personOf(survey: TakeSurvey, letter: string): SurveyedPerson | null {
    return survey.people.find((person) => person.letter === letter.trim().toUpperCase()) ?? null;
  }

  /** The parts each surveyed take is framed in: the take whole, or its stretches between the switches chosen for it. */
  private async plannedOf(surveys: ReadonlyArray<TakeSurvey>, choices: ReadonlyArray<TakeChoice>, run: ReframeRun, warnings: string[]): Promise<PlannedPart[]> {
    const planned: PlannedPart[] = [];
    for (const survey of surveys) {
      const { take } = survey;
      const chosen = choices.find((choice) => choice.take === take.index);
      let current: FramingChoice = chosen ?? this.unchosen(survey, warnings);
      let fromSec = take.startSec;
      for (const next of [...(chosen?.switches ?? [])].sort((first, second) => first.atSec - second.atSec)) {
        const atSec = await this.switchAt(take, next.atSec, fromSec, run);
        if (atSec === null) {
          warnings.push(`The switch at ${next.atSec.toFixed(1)} s in take ${take.index} was left out: it is less than ${MIN_PART_SEC} s from the take's ends or from the switch before it.`);
          continue;
        }
        planned.push(this.plannedPart(survey, fromSec, atSec, current));
        fromSec = atSec;
        current = next;
      }
      planned.push(this.plannedPart(survey, fromSec, take.endSec, current));
    }
    return planned;
  }

  /**
   * What a take nobody chose for shows: its one person, its middle where
   * it has none, and where it has several the one nearest the camera,
   * with a warning, since that is a guess.
   */
  private unchosen(survey: TakeSurvey, warnings: string[]): FramingChoice {
    const [first] = survey.people;
    if (first === undefined) return { subject: { kind: 'point', x: CENTRED, y: null }, closeness: null, name: null };
    const nearest = survey.people.reduce((best, person) => ((person.headHeight ?? 0) > (best.headHeight ?? 0) ? person : best), first);
    if (survey.people.length > 1) {
      warnings.push(`Take ${survey.take.index} holds several people and nobody chose whom it shows: it shows person ${nearest.letter}, the nearest the camera.`);
    }
    return { subject: { kind: 'person', letter: nearest.letter }, closeness: null, name: null };
  }

  private plannedPart(survey: TakeSurvey, startSec: number, endSec: number, choice: FramingChoice): PlannedPart {
    const name = choice.name ?? this.nameOf(choice);
    return {
      part: { take: survey.take.index, startSec, endSec, content: this.contentOf(survey, choice), subject: { description: name, name } },
      survey,
      choice,
    };
  }

  private nameOf(choice: FramingChoice): string {
    if (choice.subject.kind === 'person') return `person ${choice.subject.letter.trim().toUpperCase()}`;
    return choice.subject.x === CENTRED && choice.subject.y === null ? 'the middle of the picture' : 'the point chosen';
  }

  /** A part on a point follows nobody; one on a person may, and is framed as one of several where the take holds more. */
  private contentOf(survey: TakeSurvey, choice: FramingChoice): TakeContent {
    if (choice.subject.kind === 'point') return 'no person';
    return survey.people.length > 1 ? 'several people' : 'one person';
  }

  /**
   * Where a switch asked at `atSec` falls in `take`, whose part before it
   * starts at `fromSec`: a shot opening in the silence before the word
   * that starts nearest, the one already there or one opened for it; on
   * the moment itself where nothing is said near it. Null where that
   * would leave a part too short.
   */
  private async switchAt(take: VideoTake, atSec: number, fromSec: number, run: ReframeRun): Promise<number | null> {
    const earliest = fromSec + MIN_PART_SEC;
    const latest = take.endSec - MIN_PART_SEC;
    if (latest < earliest) return null;
    const word = this.speech.wordNearest(atSec, earliest, latest);
    if (word === null || Math.abs(word.startSec - atSec) > SWITCH_WORD_REACH_SEC) {
      return atSec < earliest || atSec > latest ? null : this.openedAt(await this.edit('split_shots', { atSec: [atSec] }, run));
    }
    const existing = this.shots.shots().find((shot) => shot.startSec > fromSec && shot.startSec <= word.startSec && word.startSec - shot.startSec <= SWITCH_SILENCE_SEC);
    if (existing !== undefined) return existing.startSec;
    return this.openedAt(await this.edit('split_shots', { beforeWords: [this.parser.formatOf('word', word.wordId)] }, run));
  }

  /** Where the shot a split was asked for opens: the one it opened, or the one already there. */
  private openedAt(split: OperationResult): number | null {
    if (!split.ok) return null;
    const output = split.output as { readonly opened?: ReadonlyArray<{ readonly atSec: number }>; readonly alreadyOpen?: ReadonlyArray<{ readonly atSec: number }> } | null;
    return output?.opened?.[0]?.atSec ?? output?.alreadyOpen?.[0]?.atSec ?? null;
  }

  /** Frames every part by its choice, writes it on the part's shots, and has the camera follow its person where they move out of it. */
  private async framedAll(planned: ReadonlyArray<PlannedPart>, geometry: FramingGeometry, run: ReframeRun, warnings: string[]): Promise<FramedPart[]> {
    const framed: FramedPart[] = [];
    for (const [index, each] of planned.entries()) {
      run.progress.report({ label: FRAMING, done: index, total: planned.length, fraction: index / planned.length });
      const decision = this.decisionOf(each, geometry);
      const written = await this.writer.framed(each.part, decision, run, warnings);
      if (written === null) continue;
      framed.push(await this.writer.followed(written, await this.followOf(each.part, decision, geometry, run.signal), run, warnings));
    }
    run.progress.report({ label: FRAMING, done: planned.length, total: planned.length, fraction: 1 });
    return framed;
  }

  private decisionOf(planned: PlannedPart, geometry: FramingGeometry): FramingDecision {
    const { subject, closeness } = planned.choice;
    const person = subject.kind === 'person' ? this.personOf(planned.survey, subject.letter) : null;
    if (person !== null) return this.framing.onPerson(person, geometry, closeness);
    return this.framing.onPoint(subject.kind === 'point' ? subject : { x: CENTRED, y: null }, geometry, closeness);
  }

  /** Whether the person `part` frames, on the crop `decision` chose, moves out of it, and how to follow them where they do. */
  private followOf(part: FramingPart, decision: FramingDecision, geometry: FramingGeometry, signal: AbortSignal): Promise<PartFollowOutcome> {
    if (part.content === 'no person') return Promise.resolve(FIXED);
    const crop = { width: geometry.sideAt(decision.scale, 'x'), height: geometry.sideAt(decision.scale, 'y') };
    const held = geometry.centreFor({ x: decision.x, y: decision.y ?? CENTRED }, decision.scale);
    return this.follower.decide(part, held, crop, signal);
  }

  /** Whether the output frame is no longer the size `before`, so the captions were laid out again. */
  private resized(before: VideoLayout | null): boolean {
    const after = this.store.snapshot().frameLayout;
    if (before === null || after === null) return before !== after;
    return before.width !== after.width || before.height !== after.height;
  }

  private edit(name: string, input: unknown, run: ReframeRun): Promise<OperationResult> {
    return this.runner.run(name, input, run.historyGroup);
  }
}
