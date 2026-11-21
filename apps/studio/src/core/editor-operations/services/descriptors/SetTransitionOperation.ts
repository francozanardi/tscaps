import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SetShotTransitionAction } from '@core/shot-transitions/actions/SetShotTransitionAction';
import type { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import {
  SHOT_TRANSITION_KINDS,
  SHOT_TRANSITION_RECOMMENDED_DURATION_SEC,
  type ShotTransition,
  type ShotTransitionKind,
} from '@core/shots/domain/ShotTransition';
import { ShotTransitionSanitizer } from '@core/shots/domain/ShotTransitionSanitizer';

const KIND_TEXT = [
  'How the picture passes into the shot. blur: blurs out and back into focus.',
  'whip, whip-up: a fast blurred pan sideways or upwards, the next shot panning in from the other side.',
  'spin: turns away and the next shot turns in. shake: the frame jolts on the cut and settles.',
  'glitch: the frame jumps and flickers around the cut. flash: a burst of light, white on the cut, the next shot coming back overexposed.',
  'fade-white: the picture burns out into white and the next shot comes out of the glare. fade-black: a dip to black.',
  'wipe: a black panel passes across in one motion, pushing the shot out and the next one in after it.',
  'iris: a circle closes on the centre of the picture and the next shot opens out of it. null: a plain cut.',
].join(' ');
const RECOMMENDED_DURATIONS_SEC = Object.values(SHOT_TRANSITION_RECOMMENDED_DURATION_SEC);

/**
 * `set_transition`: sets how the picture passes into a shot from the
 * one before it, or makes the cut plain again, with the sound the kind
 * suggests on the cut. A kind picked starts at its recommended length,
 * and the kind a shot has keeps its own; a sound the person took off
 * stays off unless the caller asks for it again.
 */
export class SetTransitionOperation implements EditorOperation {
  readonly name = 'set_transition';
  readonly effect = 'edit';
  readonly description = [
    'Set the transition on the cut into a shot from the shot before it, or make that cut plain again (kind null).',
    `It plays over the whole frame for durationSec (${ShotTransitionSanitizer.MIN_DURATION_SEC} to ${ShotTransitionSanitizer.MAX_DURATION_SEC} s), centred on the cut: half before, half after.`,
    'The first shot has no cut before it and is refused.',
    'Most kinds bring a suggested sound on the cut (answered in `sounds`; sound false leaves it out); a plain cut takes every sound on the transition off.',
  ].join(' ');

  private readonly input = new OperationInput({
    shot: z.string().describe('The shot the transition leads into, as shot:<id>: it plays on the cut between it and the shot before.'),
    kind: z.enum(SHOT_TRANSITION_KINDS).nullable().describe(KIND_TEXT),
    durationSec: z.number().min(ShotTransitionSanitizer.MIN_DURATION_SEC).max(ShotTransitionSanitizer.MAX_DURATION_SEC).optional()
      .describe(`How long it takes in all, in seconds. Default: the kind's own (${Math.min(...RECOMMENDED_DURATIONS_SEC)} to ${Math.max(...RECOMMENDED_DURATIONS_SEC)} s), or the length it has where the kind does not change.`),
    sound: z.boolean().optional()
      .describe('Whether the kind\'s suggested sound plays on the cut (fade-black and iris have none). Default: yes, unless it was taken off this transition before.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly suggestions: ShotTransitionSoundSuggestions,
    private readonly setTransition: SetShotTransitionAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { shot: ref, kind, durationSec, sound } = checked.value;
    const resolved = this.shots.resolveShot(ref);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const { shot, index } = resolved.value;
    if (index === 0) {
      return this.refused([this.problem(`${ref} is the first shot: no cut leads into it. Give the shot the transition leads into.`, ref)]);
    }
    if (kind === null) {
      if (durationSec !== undefined) return this.refused([this.problem('kind null makes the cut plain: durationSec cannot be set with it.', ref)]);
      this.setTransition.execute(shot.id, null, false);
      return this.answered(ref, shot.id);
    }
    const held = shot.transition ?? null;
    const transition = { kind, durationSec: durationSec ?? this.lengthOf(kind, held) };
    const withSound = sound ?? this.suggestions.keepsSound(this.store.snapshot().audio, shot.id, held);
    this.setTransition.execute(shot.id, transition, withSound);
    return this.answered(ref, shot.id);
  }

  /** The length a kind picked takes: its own, or the one held where the kind stays. */
  private lengthOf(kind: ShotTransitionKind, held: ShotTransition | null): number {
    return held?.kind === kind ? held.durationSec : SHOT_TRANSITION_RECOMMENDED_DURATION_SEC[kind];
  }

  private answered(ref: string, shotId: string): OperationResult {
    const shot = this.shots.resolveShot(ref);
    const transition = shot.ok ? shot.value.shot.transition ?? null : null;
    const sounds = this.suggestions.clipsOn(this.store.snapshot().audio, shotId).map((clip) => this.parser.formatOf('sound', clip.id));
    return {
      ok: true,
      output: { shot: ref, transition: transition === null ? null : { kind: transition.kind, durationSec: transition.durationSec }, sounds },
      problems: [],
    };
  }

  private problem(message: string, ref: string): OperationProblem {
    return { severity: 'error', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
