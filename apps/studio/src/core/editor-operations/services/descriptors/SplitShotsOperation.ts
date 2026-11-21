import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ProjectShot, ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import type { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import type { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';

// The shortest shot a split may leave on either side of it.
const MIN_SHOT_SEC = 0.1;
// A camera change this near a shot's opening moves the opening there, rather than leaving a sliver of a shot.
const NEAR_OPENING_SEC = 0.4;

/** A shot that opens where a split was asked (opened by it, or already there), the time it opens at, and the word it was asked to open on. */
interface OpenedShot {
  readonly atSec: number;
  readonly shot: string;
  readonly beforeWord?: string;
  /** For a shot the split opened: the shot it now comes right after, once every split of the call is made. */
  readonly follows?: string;
}

/** A place a split was asked for: a time, or the time a shot opening on a word opens at. */
interface SplitRequest {
  readonly sec: number;
  readonly word: string | null;
}

/** A shot whose opening was moved onto a camera change next to it. */
interface MovedShot {
  readonly shot: string;
  readonly fromSec: number;
  readonly toSec: number;
}

/**
 * `split_shots`: opens a shot at each time asked, before each word
 * asked (in the silence before it, as the editor's own split on a word
 * does), or at each of the source's own camera changes, cutting the
 * shot that covers it in two. A camera change just next to an opening
 * moves that opening onto it instead. Each place is checked
 * on its own against the shots as they stand after the ones before it:
 * where a shot already opens (a word right after a cut, say) that shot is
 * answered as it is, since it is what the split was for; a place outside
 * the video or too close to its end is refused with a problem, and the
 * others are still split.
 * A split changes nothing the viewer sees: the layers on the cut shot
 * and the camera or framing drawn on it run on over both halves.
 */
export class SplitShotsOperation implements EditorOperation {
  readonly name = 'split_shots';
  readonly effect = 'edit';
  readonly description = [
    'Open a new shot before each word in `beforeWords`, or at each time in `atSec` (seconds of the source video, the times the transcript uses), cutting the shot that covers it in two.',
    'Prefer `beforeWords` when a shot should start with what is said: the cut lands in the silence before the word, where the editor itself cuts, never inside speech.',
    'A split changes nothing that is seen: the cut shot\'s layers, and any layer showing through it, go on showing over both halves, as one layer, and so does the camera or framing drawn on it: a camera move as one move, a punch-in or a framing as each half\'s own. To end a layer or a move at the split, give it the first half as `through` (set_layer for a layer, set_camera for the camera); a punch-in is changed or taken off on the half itself. The transition stays on the first half.',
    `Where a shot already opens (less than ${MIN_SHOT_SEC} s away, as before a word right after a cut), nothing is split and that shot is answered under \`alreadyOpen\`; a time outside the video or less than ${MIN_SHOT_SEC} s from its end is refused. The other places are still split.`,
    'Answers the shot that opens at each place; the first half of a cut shot keeps its ref. To show something from t1 to t2, split at both and put it on the shot in between.',
    '`atCameraChanges: true` opens a shot wherever the video\'s own picture changes (a switch of camera, an edit already in it), so every shot holds one camera angle and can be framed on its own; a change next to an opening moves that opening there. Run it before reframing a video for another shape.',
  ].join(' ');

  private readonly input = new OperationInput({
    beforeWords: z.array(z.string()).max(20).optional()
      .describe('Words a new shot opens on, as refs: word:<id>; up to 20, in any order.'),
    atSec: z.array(z.number()).max(20).optional()
      .describe('Where each new shot opens, in seconds of the source video; up to 20 times, in any order.'),
    atCameraChanges: z.boolean().optional()
      .describe('true: also open a shot at every change of camera in the video itself. Takes a few seconds where the video has not been read for them yet.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly openings: ShotWordOpeningResolver,
    private readonly split: SplitShotAction,
    private readonly moveStart: MoveShotStartAction,
    private readonly pictureChanges: PictureChangeReader,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return { ok: false, output: null, problems: checked.problems };
    if (this.shots.shots().length === 0) {
      return { ok: false, output: null, problems: [this.error('The project has no video yet, so it has no shots to split.')] };
    }
    const { beforeWords = [], atSec = [], atCameraChanges = false } = checked.value;
    if (beforeWords.length + atSec.length === 0 && !atCameraChanges) {
      return { ok: false, output: null, problems: [this.error('Give beforeWords, atSec or atCameraChanges.')] };
    }
    const requests = this.requestsOf(beforeWords, atSec);
    if (!requests.ok) return { ok: false, output: null, problems: requests.problems };
    const moved: MovedShot[] = [];
    const cameraChanges = atCameraChanges ? await this.cameraChangeRequests(moved) : [];
    const opened: OpenedShot[] = [];
    const alreadyOpen: OpenedShot[] = [];
    const problems: OperationProblem[] = [];
    for (const { sec, word } of [...requests.requests, ...cameraChanges]) {
      const existing = this.shotOpeningAt(sec);
      if (existing !== null) {
        alreadyOpen.push(this.openedShot(existing.startSec, existing.ref, word));
        continue;
      }
      const refusal = this.refusalOf(sec);
      if (refusal !== null) {
        problems.push(word === null ? refusal : { ...refusal, message: `${word}: ${refusal.message}` });
        continue;
      }
      const cut = this.shots.shotAt(sec)!;
      this.split.execute(sec);
      const shot = this.shots.shotAt(sec);
      if (shot === null || shot.startSec !== sec) {
        problems.push(this.error(`Nothing was split at ${this.rounded(sec)} s.`));
        continue;
      }
      opened.push(this.openedShot(sec, shot.ref, word));
      problems.push(...this.warningsFor(cut, shot, sec));
    }
    const answered = opened.length > 0 || moved.length > 0 || alreadyOpen.length > 0;
    if (atCameraChanges && !answered && problems.length === 0) {
      return { ok: true, output: { opened, note: 'The video has no change of camera that is not already a shot boundary.' }, problems };
    }
    const output = { opened: this.withShotBefore(opened), ...(alreadyOpen.length > 0 ? { alreadyOpen } : {}), ...(moved.length > 0 ? { moved } : {}) };
    return { ok: answered, output: answered ? output : null, problems };
  }

  private openedShot(sec: number, shot: string, word: string | null): OpenedShot {
    return { atSec: this.rounded(sec), shot, ...(word === null ? {} : { beforeWord: word }) };
  }

  /**
   * `opened`, each with the shot it comes right after as the shots now
   * stand: the first half of the shot it was cut from, or another shot
   * the same call opened inside that one.
   */
  private withShotBefore(opened: ReadonlyArray<OpenedShot>): OpenedShot[] {
    const shots = this.shots.shots();
    return opened.map((entry) => {
      const before = shots[shots.findIndex((shot) => shot.ref === entry.shot) - 1];
      return before === undefined ? entry : { ...entry, follows: before.ref };
    });
  }

  /** The shot that opens less than the shortest shot away from `sec`, or null where none does. */
  private shotOpeningAt(sec: number): ProjectShot | null {
    return this.shots.shots().find((shot) => Math.abs(shot.startSec - sec) < MIN_SHOT_SEC) ?? null;
  }

  /**
   * Where the video's own picture changes, as places to split, past the
   * ones just next to an opening, which move that opening there (each
   * one recorded in `moved`). Changes inside what is cut out, or at the
   * very start or end, are left out.
   */
  private async cameraChangeRequests(moved: MovedShot[]): Promise<SplitRequest[]> {
    const state = this.store.snapshot();
    const changes = state.video.pictureChangesSec ?? await this.pictureChanges.read();
    const requests: SplitRequest[] = [];
    for (const sec of changes) {
      const now = this.store.snapshot();
      if (sec < NEAR_OPENING_SEC || sec > now.video.duration - NEAR_OPENING_SEC || now.cuts.isCut(sec)) continue;
      const near = this.shots.shots().find((shot) => Math.abs(shot.startSec - sec) <= NEAR_OPENING_SEC);
      if (near === undefined) {
        requests.push({ sec, word: null });
        continue;
      }
      if (near.startSec === 0 || Math.abs(near.startSec - sec) < 0.001) continue;
      this.moveStart.execute(near.shot.id, sec);
      moved.push({ shot: near.ref, fromSec: this.rounded(near.startSec), toSec: this.rounded(sec) });
    }
    return requests;
  }

  /** Where each split was asked for: the words first, read before anything is split, then the times. */
  private requestsOf(
    words: ReadonlyArray<string>,
    times: ReadonlyArray<number>,
  ): { ok: true; requests: SplitRequest[] } | { ok: false; problems: OperationProblem[] } {
    const state = this.store.snapshot();
    const requests: SplitRequest[] = [];
    const problems: OperationProblem[] = [];
    for (const word of words) {
      const ref = this.parser.parse(word);
      const sec = ref?.kind === 'word' ? this.openings.openingBefore(state, ref.id) : null;
      if (sec === null) problems.push(this.error(`${word} is not a word said in the video; use word refs from the transcript.`));
      else requests.push({ sec, word });
    }
    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, requests: [...requests, ...times.map((sec) => ({ sec, word: null }))] };
  }

  /** Why no shot can open at `sec`, where no shot opens yet, or null where one can. */
  private refusalOf(sec: number): OperationProblem | null {
    const shots = this.shots.shots();
    const endSec = shots[shots.length - 1]!.endSec;
    if (sec >= MIN_SHOT_SEC && sec <= endSec - MIN_SHOT_SEC) return null;
    return this.error(`${this.rounded(sec)} s is outside the video or less than ${MIN_SHOT_SEC} s from its end (it runs from 0 to ${this.rounded(endSec)} s).`);
  }

  /** What the person may not expect of a split at `sec` of `cut`, which opened `opened`. */
  private warningsFor(cut: ProjectShot, opened: ProjectShot, sec: number): OperationProblem[] {
    const warnings: OperationProblem[] = [];
    const layers = cut.shot.layers.length;
    if (layers > 0) {
      warnings.push(this.warning(
        `${layers === 1 ? `The layer of ${cut.ref} still shows` : `The ${layers} layers of ${cut.ref} still show`} over both halves, through ${opened.ref}; to end one at ${this.rounded(sec)} s, call set_layer on it with through: ${cut.ref}.`,
        cut.ref,
      ));
    }
    const state = this.store.snapshot();
    const drawnBy = state.shots.videoShotOf(opened.shot.id);
    if (drawnBy !== null && drawnBy.id !== opened.shot.id && state.shots.hasCamera(drawnBy.id)) {
      const owner = this.parser.formatOf('shot', drawnBy.id);
      warnings.push(this.warning(
        `The camera of ${owner} still runs over both halves, through ${opened.ref}; to end it at ${this.rounded(sec)} s, call set_camera on ${owner} with through: ${cut.ref}.`,
        owner,
      ));
    }
    if (state.cuts.isCut(sec)) {
      warnings.push(this.warning(`${this.rounded(sec)} s is inside a cut, so in the output ${opened.ref} starts where the cut ends.`, opened.ref));
    }
    return warnings;
  }

  private rounded(sec: number): number {
    return Math.round(sec * 100) / 100;
  }

  private warning(message: string, ref: string): OperationProblem {
    return { severity: 'warning', message, ref };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }
}
