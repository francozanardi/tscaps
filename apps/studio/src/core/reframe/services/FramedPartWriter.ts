import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { FramingDecision } from '@core/reframe/domain/FramingDecision';
import type { FramedPart, FramingPart } from '@core/reframe/domain/FramingPart';
import type { PartFollowOutcome } from '@core/reframe/domain/PartFollower';
import type { ReframeRun } from '@core/reframe/domain/ReframeRun';
import type { ShotFollowWriter } from '@core/reframe/domain/ShotFollowWriter';

const FOLLOW_FAILED = 'The people in the video could not be looked at on this device, so a person who moves is not followed: their part keeps a fixed framing.';

/**
 * Writes what a reframe chose for a part on the shots of that part: its
 * framing, the same on each so nothing jumps between them, and whether
 * their camera follows the person it frames. Every change joins the
 * run's checkpoint; what could not be written is said in the warnings it
 * is given.
 */
export class FramedPartWriter {
  constructor(
    private readonly runner: EditorOperationRunner,
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly follows: ShotFollowWriter,
  ) {}

  /** Writes `decision` on the shots of `part`; null, with a warning, where there is no decision or no shot to write it on. */
  async framed(part: FramingPart, decision: FramingDecision | null, run: ReframeRun, warnings: string[]): Promise<FramedPart | null> {
    const range = `${part.startSec.toFixed(1)}–${part.endSec.toFixed(1)} s`;
    if (decision === null) {
      warnings.push(`No picture of ${range} could be read, so it keeps the frame's own crop.`);
      return null;
    }
    const shots = this.shotsWithin(part);
    if (shots.length === 0) {
      warnings.push(`No shot lies within ${range}, so nothing was framed there.`);
      return null;
    }
    const result = await this.runner.run('set_framing', { shots, x: decision.x, y: decision.y, scale: decision.scale }, run.historyGroup);
    warnings.push(...result.problems.map((problem) => problem.message));
    if (!result.ok) return null;
    return { take: part.take, startSec: part.startSec, endSec: part.endSec, content: part.content, subject: part.subject, framing: decision, shots, follows: false };
  }

  /**
   * `part` with its shots following its person as `outcome` says, or
   * following no one; a part that keeps its framing for want of time or
   * because the people could not be looked at says so in `warnings`.
   */
  async followed(part: FramedPart, outcome: PartFollowOutcome, run: ReframeRun, warnings: string[]): Promise<FramedPart> {
    const follow = outcome.kind === 'follow' ? outcome.follow : null;
    const shotIds = part.shots.flatMap((ref) => {
      const shot = this.shots.resolveShot(ref);
      return shot.ok ? [shot.value.shot.id] : [];
    });
    await this.store.withHistoryGroup(run.historyGroup, () => {
      for (const shotId of shotIds) this.follows.execute(shotId, follow);
    });
    if (outcome.kind === 'too-long') {
      warnings.push(`Following the person in ${part.startSec.toFixed(1)}–${part.endSec.toFixed(1)} s would take too long on this device, so that part keeps a fixed framing.`);
    }
    if (outcome.kind === 'failed' && !warnings.includes(FOLLOW_FAILED)) warnings.push(FOLLOW_FAILED);
    return { ...part, follows: follow !== null };
  }

  /** The shots whose middle falls inside `part`, as refs. */
  private shotsWithin(part: FramingPart): string[] {
    return this.shots.shots()
      .filter((shot) => {
        const middle = (shot.startSec + shot.endSec) / 2;
        return middle >= part.startSec && middle < part.endSec;
      })
      .map((shot) => shot.ref);
  }
}
