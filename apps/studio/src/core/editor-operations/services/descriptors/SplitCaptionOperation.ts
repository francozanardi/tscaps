import { z } from 'zod';
import type { Document } from '@tscaps/engine';
import type { ApplyStructureEditAction } from '@core/captions/actions/segments/ApplyStructureEditAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

/**
 * `split_caption`: breaks a scene in two so a chosen word starts the
 * second one, as Enter in the transcript does. Words keep their text and
 * times; the two scenes keep this layout through later style changes.
 */
export class SplitCaptionOperation implements EditorOperation {
  readonly name = 'split_caption';
  readonly effect = 'edit';
  readonly description = [
    'Break a caption (scene) in two, so the word `before` starts a new one: for pacing (fewer words on screen at once), or to give part of a sentence a look of its own with move_to_sheet or set_element_css.',
    'Words keep their text and times. The two scenes keep this layout when the style changes later. Answers the refs of both scenes.',
  ].join(' ');

  private readonly input = new OperationInput({
    before: z.string().describe('The word that starts the new caption, as a ref: word:<id>. Not the first word of its caption.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly captions: CaptionRefResolver,
    private readonly structure: CaptionStructureEditor,
    private readonly applyStructureEdit: ApplyStructureEditAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const word = this.captions.resolve(checked.value.before, ['word']);
    if (!word.ok) return this.refused([word.problem]);
    const document = this.store.snapshot().document;
    const edited = document === null ? null : this.structure.splitBefore(document, word.value.id);
    if (edited === null) {
      return this.refused([{ severity: 'error', message: `${word.value.ref} already starts its caption; pick a word inside one.`, ref: word.value.ref }]);
    }
    this.applyStructureEdit.execute(edited);
    const after = this.store.snapshot().document;
    return { ok: true, output: { captions: after === null ? [] : this.scenesAround(after, word.value.id) }, problems: [] };
  }

  /** The refs of the scene ending just before word `wordId` and of the scene it starts. */
  private scenesAround(document: Document, wordId: string): string[] {
    const segments = document.getSegments();
    const index = segments.findIndex((segment) => segment.getWords().some((word) => word.id === wordId));
    return segments.slice(Math.max(0, index - 1), index + 1).map((segment) => this.parser.formatOf('segment', segment.id));
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
