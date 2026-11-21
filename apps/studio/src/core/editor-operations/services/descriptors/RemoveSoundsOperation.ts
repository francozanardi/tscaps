import { z } from 'zod';
import type { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

/**
 * `remove_sounds`: takes sounds off the soundtrack by their refs, all
 * in one undo step, or none of them when one ref names no sound.
 */
export class RemoveSoundsOperation implements EditorOperation {
  readonly name = 'remove_sounds';
  readonly effect = 'edit';
  readonly description = [
    'Take sounds off the soundtrack, by their refs (sound:<id>): sound effects, and the sounds a transition or a camera move brought.',
    'The transition or camera move itself stays. Sound files stay in the project.',
    'Refuses them all, removing none, when a ref names no sound of the project.',
  ].join(' ');

  private readonly input = new OperationInput({
    sounds: z.array(z.string()).min(1).max(100).describe('The sounds to remove, as sound:<id> refs.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly removeClips: RemoveAudioClipsAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const audio = this.store.snapshot().audio;
    const clipIds: string[] = [];
    const problems: OperationProblem[] = [];
    for (const ref of checked.value.sounds) {
      const parsed = this.parser.parse(ref);
      if (parsed === null || parsed.kind !== 'sound') {
        problems.push({ severity: 'error', message: `"${ref}" is not a sound ref; sound refs look like sound:<id>.`, ref });
      } else if (audio.clip(parsed.id) === null) {
        problems.push({ severity: 'error', message: `${ref} is not a sound of the project any more.`, ref });
      } else {
        clipIds.push(parsed.id);
      }
    }
    if (problems.length > 0) return this.refused(problems);
    this.removeClips.execute(clipIds);
    return { ok: true, output: { removed: [...new Set(clipIds)].map((id) => this.parser.formatOf('sound', id)) }, problems: [] };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
