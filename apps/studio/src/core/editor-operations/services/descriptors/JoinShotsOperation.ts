import { z } from 'zod';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ProjectShot, ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { JoinShotAction } from '@core/shots/actions/JoinShotAction';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/** A shot taken back into the one before it. */
interface JoinedShot {
  readonly shot: string;
  readonly into: string;
}

/**
 * `join_shots`: takes shots back into the shots before them. Every ref is
 * checked before anything is joined, and nothing is joined when one is
 * refused: joining part of a run the caller meant as a whole would merge
 * shots nobody asked to merge.
 */
export class JoinShotsOperation implements EditorOperation {
  readonly name = 'join_shots';
  readonly effect = 'edit';
  readonly description = [
    'Join each shot in `shots` into the shot just before it: the two play as one shot under the earlier shot\'s ref, and the joined shot\'s ref is gone.',
    'The joined shot\'s layers move onto the earlier shot and now open where it opens, still showing as far as they did; a layer that showed through the joined shot shows through the joined pair. Its transition, and the camera, framing and CSS of its own video, are dropped; sounds anchored to it stop playing. Warnings name each of these.',
    'The first shot has nothing before it and is refused. Nothing is joined when any ref is refused.',
  ].join(' ');

  private readonly input = new OperationInput({
    shots: z.array(z.string()).min(1).max(20)
      .describe('The shots to join into the shot before each, as refs (shot:<id>). To make one shot of several in a row, give all but the first of them.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly join: JoinShotAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const resolved = this.resolved([...new Set(checked.value.shots)]);
    if (!resolved.ok) return this.refused(resolved.problems);
    const joined: JoinedShot[] = [];
    const warnings: OperationProblem[] = [];
    for (const target of resolved.shots) {
      const current = this.shots.shots();
      const index = current.findIndex((shot) => shot.shot.id === target.shot.id);
      const shot = current[index]!;
      const into = current[index - 1]!;
      warnings.push(...this.lossesOf(shot, into));
      this.join.execute(shot.shot.id);
      joined.push({ shot: shot.ref, into: into.ref });
    }
    return { ok: true, output: { joined, shots: this.spansOf(joined) }, problems: warnings };
  }

  /** The shots `refs` name, in their order on the timeline, or why one of them cannot be joined. */
  private resolved(refs: ReadonlyArray<string>): { ok: true; shots: ProjectShot[] } | { ok: false; problems: OperationProblem[] } {
    const shots: ProjectShot[] = [];
    const problems: OperationProblem[] = [];
    for (const ref of refs) {
      const shot = this.shots.resolveShot(ref);
      if (!shot.ok) problems.push(shot.problem);
      else if (shot.value.index === 0) problems.push({ severity: 'error', message: `${ref} is the first shot: there is no shot before it to join it into.`, ref });
      else shots.push(shot.value);
    }
    return problems.length > 0 ? { ok: false, problems } : { ok: true, shots: shots.sort((first, second) => first.index - second.index) };
  }

  /** What joining `shot` into `into` drops or moves, as warnings. */
  private lossesOf(shot: ProjectShot, into: ProjectShot): OperationProblem[] {
    const state = this.store.snapshot();
    const losses: OperationProblem[] = [];
    const layers = shot.shot.layers.length;
    if (layers > 0) {
      const moved = layers === 1 ? `The layer of ${shot.ref} moved onto ${into.ref} and now opens` : `The ${layers} layers of ${shot.ref} moved onto ${into.ref} and now open`;
      losses.push(this.warning(`${moved} where that shot opens (${this.rounded(into.startSec)} s).`, shot.ref));
    }
    if (shot.shot.transition !== undefined) {
      losses.push(this.warning(`The ${shot.shot.transition.kind} transition into ${shot.ref} was dropped.`, shot.ref));
    }
    if (state.shots.layerStyles.get(ShotVideoLayerId.of(shot.shot.id)) !== null) {
      const ranOn = shot.shot.videoThroughShotId === undefined ? '' : ' The later shots it ran over keep them.';
      losses.push(this.warning(`The camera, framing and CSS of ${shot.ref}'s own video were dropped.${ranOn}`, shot.ref));
    }
    const sounds = state.audio.clips().filter((clip) => this.namesShot(clip.start.anchor, shot.shot.id));
    if (sounds.length > 0) {
      losses.push(this.warning(`These sounds were anchored to ${shot.ref} and no longer play: ${sounds.map((clip) => this.parser.formatOf('sound', clip.id)).join(', ')}`, shot.ref));
    }
    return losses;
  }

  private namesShot(anchor: AudioAnchor, shotId: string): boolean {
    return (anchor.kind === 'shot' || anchor.kind === 'transition' || anchor.kind === 'camera') && anchor.shotId === shotId;
  }

  /** Where each shot something was joined into runs now, in seconds of the source video. */
  private spansOf(joined: ReadonlyArray<JoinedShot>): Array<{ shot: string; startSec: number; endSec: number }> {
    const targets = new Set(joined.map((each) => each.into));
    return this.shots.shots()
      .filter((shot) => targets.has(shot.ref))
      .map((shot) => ({ shot: shot.ref, startSec: this.rounded(shot.startSec), endSec: this.rounded(shot.endSec) }));
  }

  private rounded(sec: number): number {
    return Math.round(sec * 100) / 100;
  }

  private warning(message: string, ref: string): OperationProblem {
    return { severity: 'warning', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
