import { z } from 'zod';
import type { DeleteWordsAction } from '@core/captions/actions/words/DeleteWordsAction';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

const MAX_WORDS = 200;

/**
 * `delete_words`: takes words out of the captions, as deleting them in
 * the transcript does. The video and its sound are untouched. Every ref
 * is checked before anything is deleted.
 */
export class DeleteWordsOperation implements EditorOperation {
  readonly name = 'delete_words';
  readonly effect = 'edit';
  readonly description = [
    'Take words out of the captions only: the video still shows and says them. Use it for words that should not be read on screen (a filler the person keeps in the video, a transcription mistake).',
    'To remove what was said from the video itself (a filler, a false start, a repeated take), cut it from the video instead: the cut takes its captions with it.',
  ].join(' ');

  private readonly input = new OperationInput({
    words: z.array(z.string()).min(1).max(MAX_WORDS).describe('The words, as refs: word:<id>.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly deleteWords: DeleteWordsAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const resolved = checked.value.words.map((ref) => this.captions.resolve(ref, ['word']));
    const problems = resolved.flatMap((each) => (each.ok ? [] : [each.problem]));
    if (problems.length > 0) return this.refused(problems);
    const words = resolved.flatMap((each) => (each.ok ? [each.value] : []));
    this.deleteWords.execute(words.map((word) => word.id));
    return { ok: true, output: { deleted: words.map((word) => ({ word: word.ref, text: word.text })) }, problems: [] };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
