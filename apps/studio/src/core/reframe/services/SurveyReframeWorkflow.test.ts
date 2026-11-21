import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { SetFramingOperation } from '@core/editor-operations/services/descriptors/SetFramingOperation';
import { SetOutputFrameOperation } from '@core/editor-operations/services/descriptors/SetOutputFrameOperation';
import { SplitShotsOperation } from '@core/editor-operations/services/descriptors/SplitShotsOperation';
import { EditorOperationCatalog } from '@core/editor-operations/services/EditorOperationCatalog';
import { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ProjectFramePictureSet } from '@core/export/domain/ProjectFramePictures';
import { SetOutputFrameAction } from '@core/output-frame/actions/SetOutputFrameAction';
import { OutputFrameTelemetryReporter } from '@core/output-frame/services/OutputFrameTelemetryReporter';
import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { FramingPart } from '@core/reframe/domain/FramingPart';
import type { PartFollower, PartFollowOutcome } from '@core/reframe/domain/PartFollower';
import type { ReframeRun } from '@core/reframe/domain/ReframeRun';
import type { TakeChoice } from '@core/reframe/domain/TakeChoice';
import { FramedPartPictures } from '@core/reframe/services/FramedPartPictures';
import { FramedPartWriter } from '@core/reframe/services/FramedPartWriter';
import { PartMoments } from '@core/reframe/services/PartMoments';
import { SurveyFraming } from '@core/reframe/services/SurveyFraming';
import { SurveyReframeReadout } from '@core/reframe/services/SurveyReframeReadout';
import { SurveyReframeWorkflow } from '@core/reframe/services/SurveyReframeWorkflow';
import { TakeSpeech } from '@core/reframe/services/TakeSpeech';
import { TakeSurveyPictures } from '@core/reframe/services/TakeSurveyPictures';
import { TakeSurveyor, type PeopleSighting } from '@core/reframe/services/TakeSurveyor';
import { VideoTakes } from '@core/reframe/services/VideoTakes';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import { SetShotFollowAction } from '@core/shots/actions/SetShotFollowAction';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ShotAimPoint } from '@core/shots/services/ShotAimPoint';
import { ShotPictureArea } from '@core/shots/services/ShotPictureArea';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/**
 * A wide video made vertical by the reframe that surveys who is in each
 * take: it changes nothing until it is told whom a take of several
 * people shows, frames every take by measure on its person (closer
 * where they are small), switches person inside a take in the silence
 * before a word, frames a point where one is given, and frames only the
 * takes chosen when asked to.
 *
 * The video: 24 s, its own camera changing at 8 s and 16 s. A woman
 * alone and close (0–8 s); the two of them wide, she on the left and he
 * on the right, whom the detector finds only now and then (8–16 s);
 * then nobody on screen (16–24 s).
 */

const CAMERA_CHANGES = [8, 16];
// A 9:16 frame of a 16:9 picture shows 9/16 × 9/16 of its width at the frame's closeness.
const WHOLE_SIDE = (9 / 16) * (9 / 16);
const CLOSER = 1.5;
const WOMAN_CLOSE_X = 0.4;
const WOMAN_WIDE_X = 0.25;
const MAN_WIDE_X = 0.75;
// The seconds of the wide take in whose frame the man is found: three of its eight.
const MAN_FOUND_IN = [9, 12, 14];

function person(x: number, y: number, headHeight: number): PersonSighting {
  return { box: { minX: x - 0.05, minY: y - 0.05, maxX: x + 0.05, maxY: y + 0.3 }, head: { x, y }, source: 'pose', headHeight };
}

/** Who the detector finds at `sec` of the video above. */
function peopleAt(sec: number): PersonSighting[] {
  if (sec < 8) return [person(WOMAN_CLOSE_X, 0.35, 0.4)];
  if (sec >= 16) return [];
  return [person(WOMAN_WIDE_X, 0.25, 0.14), ...(MAN_FOUND_IN.includes(Math.floor(sec)) ? [person(MAN_WIDE_X, 0.2, 0.14)] : [])];
}

/** The detector on the video above: a frame at each stretch's start and at its rate after it. */
class ScriptedPeopleSighting implements PeopleSighting {
  constructor(private readonly fails = false) {}

  async execute(stretches: ReadonlyArray<SamplingStretch>): Promise<SightedFrame[]> {
    if (this.fails) throw new Error('The detector cannot run here');
    return stretches.flatMap((stretch) => {
      const frames: SightedFrame[] = [];
      for (let sec = stretch.startSec; sec <= stretch.endSec; sec += 1 / stretch.framesPerSecond) frames.push({ sourceSec: sec, people: peopleAt(sec) });
      return frames;
    });
  }
}

/** Where a person of the video moves: their follow, by the take of the part; every other part keeps its framing. */
class ScriptedPartFollower implements PartFollower {
  constructor(private readonly outcomes: Readonly<Record<number, PartFollowOutcome>> = {}) {}

  async decide(part: FramingPart): Promise<PartFollowOutcome> {
    return this.outcomes[part.take] ?? { kind: 'fixed' };
  }
}

const WALKING: ShotFollow = {
  pictureAspectRatio: 16 / 9,
  heads: [{ sourceSec: 1, x: 0.3, y: 0.3 }, { sourceSec: 4, x: 0.5, y: 0.3 }, { sourceSec: 7, x: 0.7, y: 0.3 }],
  picked: { sourceSec: 4, people: [{ box: { minX: 0.45, minY: 0.2, maxX: 0.55, maxY: 0.9 }, head: { x: 0.5, y: 0.3 } }], chosen: 0 },
};

/** Pictures of any moment asked: stand-ins with the source's size, which nothing here draws. */
class StandInPictures {
  async pictureAt(sourceSecs: ReadonlyArray<number>): Promise<ProjectFramePictureSet> {
    return {
      frames: [...sourceSecs].sort((first, second) => first - second).map((sourceSec) => ({ sourceSec, bitmap: { width: 1920, height: 1080, close: () => undefined } as unknown as ImageBitmap })),
      width: 1920,
      height: 1080,
      notes: [],
    };
  }

  async renderAt(sourceSecs: ReadonlyArray<number>): Promise<ProjectFramePictureSet> {
    return this.pictureAt(sourceSecs);
  }
}

const SHEET: EncodedPicture = { mediaType: 'image/jpeg', base64: 'AA==', widthPx: 1, heightPx: 1 };
const SHEETS = { crops: async () => SHEET, grid: async () => SHEET, survey: async () => SHEET };
const RUN: ReframeRun = { historyGroup: { key: 'automation:reframe:test', author: 'assistant' }, signal: new AbortController().signal, progress: { report: () => undefined } };

/** Twelve words, one every two seconds, each a second and a half long and a sentence of its own. */
function speech(): Document {
  const words = Array.from({ length: 12 }, (_, index) => new Word({ id: `w${index}`, text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5), speakerId: null }));
  return new Document({ sections: [new Section({ kind: 'main', segments: words.map((word, index) => new Segment({ id: `s${index}`, lines: [new Line({ words: [word] })] })) })] });
}

/** A workflow on the video above; on `existing`'s project as it was left, where given. */
function setUp(options: { readonly follower?: PartFollower; readonly sighting?: PeopleSighting; readonly existing?: ShotOperationsFixture } = {}) {
  const fixture = options.existing ?? new ShotOperationsFixture();
  if (options.existing === undefined) {
    fixture.store.patch({ document: speech() });
    fixture.store.patchVideo({ layout: { width: 1920, height: 1080 } });
  }
  const pictureChanges = { read: async () => CAMERA_CHANGES };
  const area = new ShotPictureArea(fixture.animations);
  const refresh = { execute: () => undefined } as unknown as RefreshDocumentAction;
  const catalog = new EditorOperationCatalog([
    new SetOutputFrameOperation(fixture.store, new SetOutputFrameAction(fixture.store, refresh, new OutputFrameTelemetryReporter({ capture: () => undefined }, new TelemetryBudget({ historyGroupAuthor: null })))),
    new SplitShotsOperation(
      fixture.store, fixture.shotRefs, fixture.parser, fixture.wordOpenings, fixture.actions.split,
      new MoveShotStartAction(fixture.store, fixture.materializer, fixture.telemetry.edits), pictureChanges,
    ),
    new SetFramingOperation(fixture.store, fixture.shotRefs, fixture.animations, fixture.animationWriter, fixture.actions.setCamera, area, new ShotAimPoint()),
  ]);
  const runner = new EditorOperationRunner(catalog, fixture.store);
  const pictures = new StandInPictures();
  const speechOfTakes = new TakeSpeech(fixture.store, new OriginalCaptionTrackReader());
  const workflow = new SurveyReframeWorkflow(
    runner, fixture.store, fixture.shotRefs, fixture.parser, area,
    new VideoTakes(fixture.store, pictureChanges),
    new TakeSurveyor(fixture.store, options.sighting ?? new ScriptedPeopleSighting()),
    new TakeSurveyPictures(pictures, SHEETS),
    speechOfTakes,
    new SurveyFraming(new HeadFraming()),
    options.follower ?? new ScriptedPartFollower(),
    new FramedPartWriter(runner, fixture.store, fixture.shotRefs, new SetShotFollowAction(fixture.store, fixture.materializer)),
    new FramedPartPictures(pictures, SHEETS, new PartMoments(fixture.store)),
  );
  return { fixture, workflow, readout: new SurveyReframeReadout(speechOfTakes) };
}

function show(take: number, letter: string, switches: TakeChoice['switches'] = []): TakeChoice {
  return { take, subject: { kind: 'person', letter }, closeness: null, name: null, switches };
}

/** How each shot is framed now: where it starts, the point across the picture it centres, and how close. */
function framingsOf(fixture: ShotOperationsFixture): Array<{ startSec: number; x: number | null; scale: number }> {
  return fixture.shotRefs.shots().map((shot) => {
    const style = fixture.store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shot.shot.id));
    const animation = style?.animations?.[ElementAnimationScope.CAMERA];
    const camera = ShotCamera.of(style?.fields, animation, animation?.presetId ? fixture.animations.byId(animation.presetId) : null);
    const side = WHOLE_SIDE / camera.start.scale;
    const x = camera.start.x === null ? null : Math.round((camera.start.x * (1 - side) + side / 2) * 1000) / 1000;
    return { startSec: shot.startSec, x, scale: camera.start.scale };
  });
}

describe('SurveyReframeWorkflow', () => {
  it('changes nothing and answers who is in each take while nobody chose whom a take of several people shows', async () => {
    const { fixture, workflow, readout } = setUp();
    const before = fixture.store.snapshot();

    const outcome = await workflow.run({ format: '9:16', choices: null, onlyChosen: false }, RUN);

    expect(fixture.store.snapshot()).toBe(before);
    expect(outcome.kind).toBe('choose');
    if (outcome.kind !== 'choose') return;
    // The man is found in three of the wide take's eight frames, and is still one of its people.
    expect(outcome.surveys.map((survey) => survey.people.map((each) => [each.letter, each.head.x]))).toEqual([
      [['A', WOMAN_CLOSE_X]],
      [['A', WOMAN_WIDE_X], ['B', MAN_WIDE_X]],
      [],
    ]);
    expect(outcome.sheets).toHaveLength(1);
    const wide = (readout.survey(outcome.surveys, outcome.warnings)['takes'] as Array<Record<string, unknown>>)[1]!;
    expect(wide).toMatchObject({ take: 1, fromSec: 8, toSec: 16, people: [{ person: 'A', x: WOMAN_WIDE_X }, { person: 'B', x: MAN_WIDE_X }] });
    expect(wide['said']).toEqual([[8, 'w4.'], [10, 'w5.'], [12, 'w6.'], [14, 'w7.']]);
  });

  it('answers the survey of a video it could frame alone when asked to survey first', async () => {
    const alone: PeopleSighting = { execute: async (stretches) => (await new ScriptedPeopleSighting().execute(stretches)).map((frame) => ({ ...frame, people: frame.people.slice(0, 1) })) };
    const { fixture, workflow } = setUp({ sighting: alone });
    const before = fixture.store.snapshot();

    const outcome = await workflow.run({ format: '9:16', choices: null, onlyChosen: false, surveyFirst: true }, RUN);

    expect(outcome.kind).toBe('choose');
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('frames at once a video whose takes each hold one person or nobody', async () => {
    const alone: PeopleSighting = { execute: async (stretches) => (await new ScriptedPeopleSighting().execute(stretches)).map((frame) => ({ ...frame, people: frame.people.slice(0, 1) })) };
    const { fixture, workflow } = setUp({ sighting: alone });

    const outcome = await workflow.run({ format: '9:16', choices: null, onlyChosen: false }, RUN);

    expect(outcome.kind).toBe('framed');
    expect(fixture.store.snapshot().outputFrame).toMatchObject({ format: '9:16', fit: 'fill' });
    for (const shot of framingsOf(fixture)) {
      if (shot.startSec < 8) expect(shot).toMatchObject({ x: WOMAN_CLOSE_X, scale: 1 });
      else if (shot.startSec < 16) expect(shot).toMatchObject({ x: WOMAN_WIDE_X, scale: CLOSER });
      else expect(shot).toMatchObject({ x: 0.5, scale: 1 });
    }
  });

  it('leaves on a person framed at the frame\'s own closeness how far down the picture their head is', async () => {
    const alone: PeopleSighting = { execute: async (stretches) => (await new ScriptedPeopleSighting().execute(stretches)).map((frame) => ({ ...frame, people: frame.people.slice(0, 1) })) };
    const { fixture, workflow } = setUp({ sighting: alone });

    await workflow.run({ format: '9:16', choices: null, onlyChosen: false }, RUN);

    const first = fixture.shotRefs.shots()[0]!;
    const fields = fixture.store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(first.shot.id))?.fields;
    expect(fields?.[ShotVideoFraming.POSITION_FIELD_IDS.y]).toBeCloseTo(0.35, 3);
  });

  it('frames each take on the person chosen for it, closer where they are small in the picture', async () => {
    const { fixture, workflow } = setUp();

    const outcome = await workflow.run({ format: '9:16', choices: [show(1, 'B')], onlyChosen: false }, RUN);

    const framings = framingsOf(fixture);
    expect(framings.map((shot) => shot.startSec)).toEqual(expect.arrayContaining([8, 16]));
    for (const shot of framings) {
      if (shot.startSec < 8) expect(shot).toMatchObject({ x: WOMAN_CLOSE_X, scale: 1 });
      else if (shot.startSec < 16) expect(shot).toMatchObject({ x: MAN_WIDE_X, scale: CLOSER });
      else expect(shot).toMatchObject({ x: 0.5, scale: 1 });
    }
    expect(outcome.kind === 'framed' && outcome.report.parts.map((part) => [part.take, part.subject.name])).toEqual([[0, 'person A'], [1, 'person B'], [2, 'the middle of the picture']]);
    expect(outcome.kind === 'framed' && outcome.report.sheets).toHaveLength(1);
  });

  it('switches to another person inside a take in the silence before the word nearest the moment asked', async () => {
    const { fixture, workflow } = setUp();
    const then = { atSec: 12.3, subject: { kind: 'person', letter: 'B' }, closeness: null, name: 'the host' } as const;

    const outcome = await workflow.run({ format: '9:16', choices: [show(1, 'A', [then])], onlyChosen: false }, RUN);

    const framings = framingsOf(fixture);
    // The word nearest 12.3 s starts at 12 s; the one before it ends at 11.5 s.
    const switched = framings.find((shot) => shot.startSec > 11.5 && shot.startSec <= 12);
    expect(switched).toBeDefined();
    for (const shot of framings.filter((each) => each.startSec >= 8 && each.startSec < 16)) {
      expect(shot).toMatchObject({ x: shot.startSec < switched!.startSec ? WOMAN_WIDE_X : MAN_WIDE_X, scale: CLOSER });
    }
    expect(outcome.kind === 'framed' && outcome.report.parts.map((part) => part.subject.name)).toEqual(['person A', 'person A', 'the host', 'the middle of the picture']);
  });

  it('shows the person nearest the camera, and says it guessed, in a take of several nobody chose for', async () => {
    const { fixture, workflow } = setUp();

    const outcome = await workflow.run({ format: '9:16', choices: [], onlyChosen: false }, RUN);

    expect(framingsOf(fixture).filter((shot) => shot.startSec >= 8 && shot.startSec < 16).every((shot) => shot.x === WOMAN_WIDE_X)).toBe(true);
    expect(outcome.kind === 'framed' && outcome.report.warnings.some((warning) => warning.includes('Take 1 holds several people'))).toBe(true);
  });

  it('frames only the takes chosen when asked to, on a point where one is given, and leaves the others as they were', async () => {
    const { fixture, workflow } = setUp();
    await workflow.run({ format: '9:16', choices: [show(1, 'B')], onlyChosen: false }, RUN);
    const point: TakeChoice = { take: 2, subject: { kind: 'point', x: 0.8, y: null }, closeness: null, name: 'the red bike', switches: [] };

    const outcome = await workflow.run({ format: '9:16', choices: [point], onlyChosen: true }, RUN);

    for (const shot of framingsOf(fixture)) {
      if (shot.startSec < 8) expect(shot).toMatchObject({ x: WOMAN_CLOSE_X, scale: 1 });
      else if (shot.startSec < 16) expect(shot).toMatchObject({ x: MAN_WIDE_X, scale: CLOSER });
      else expect(shot).toMatchObject({ x: 0.8, scale: 1 });
    }
    expect(outcome.kind === 'framed' && outcome.report.parts.map((part) => part.subject.name)).toEqual(['the red bike']);
  });

  it('refuses a person the survey did not find, changing nothing', async () => {
    const { fixture, workflow } = setUp();
    const before = fixture.store.snapshot();

    const outcome = await workflow.run({ format: '9:16', choices: [show(0, 'C')], onlyChosen: false }, RUN);

    expect(outcome).toMatchObject({ kind: 'failed', problems: [expect.stringContaining('Take 0 has no person C')] });
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('where the people cannot be looked at, changes nothing and says so until told what the takes show, then frames on the points given', async () => {
    const { fixture, workflow } = setUp({ sighting: new ScriptedPeopleSighting(true) });
    const before = fixture.store.snapshot();

    const unchosen = await workflow.run({ format: '9:16', choices: null, onlyChosen: false }, RUN);

    expect(fixture.store.snapshot()).toBe(before);
    expect(unchosen).toMatchObject({ kind: 'choose', warnings: [expect.stringContaining('could not be looked at')] });

    const point: TakeChoice = { take: 1, subject: { kind: 'point', x: MAN_WIDE_X, y: null }, closeness: null, name: 'the host', switches: [] };
    const chosen = await workflow.run({ format: '9:16', choices: [point], onlyChosen: false }, RUN);

    for (const shot of framingsOf(fixture)) expect(shot).toMatchObject({ x: shot.startSec >= 8 && shot.startSec < 16 ? MAN_WIDE_X : 0.5, scale: 1 });
    expect(chosen.kind === 'framed' && chosen.report.warnings.some((warning) => warning.includes('could not be looked at'))).toBe(true);
  });

  it('follows the person of a part who moves out of its framing, and no other', async () => {
    const { fixture, workflow } = setUp({ follower: new ScriptedPartFollower({ 0: { kind: 'follow', follow: WALKING } }) });

    const outcome = await workflow.run({ format: '9:16', choices: [show(1, 'A')], onlyChosen: false }, RUN);

    const shots = fixture.store.snapshot().shots.list();
    expect(shots.filter((shot) => shot.startSec < 8).every((shot) => shot.follow !== undefined)).toBe(true);
    expect(shots.filter((shot) => shot.startSec >= 8).every((shot) => shot.follow === undefined)).toBe(true);
    expect(outcome.kind === 'framed' && outcome.report.parts.map((part) => part.follows)).toEqual([true, false, false]);
  });
});
