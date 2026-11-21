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

/** One line of a caption as the answer gives it back. */
interface CaptionLineReadout {
  readonly line: string;
  readonly text: string;
}

/**
 * `make_caption`: makes a run of words one scene of their own in one
 * step, as splitting before its first word, after its last and joining
 * every scene between would. Words keep their text and times, and the
 * scene keeps the layout through later style changes.
 */
export class MakeCaptionOperation implements EditorOperation {
  readonly name = 'make_caption';
  readonly effect = 'edit';
  readonly description = [
    'Make the words from `from` to `to` one caption (scene) of their own, shown whole while they are said: the captions around them are split and the ones between joined, in one step.',
    'For a line set apart; then set its lines with set_caption_lines. Words keep their text and times, and the caption keeps this layout when the style changes later. Answers the caption\'s ref and its lines.',
  ].join(' ');

  private readonly input = new OperationInput({
    from: z.string().describe('The caption\'s first word, as a ref: word:<id>.'),
    to: z.string().describe('Its last word, as a ref: word:<id>; the same word or one after `from`.'),
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
    const first = this.captions.resolve(checked.value.from, ['word']);
    if (!first.ok) return this.refused([first.problem]);
    const last = this.captions.resolve(checked.value.to, ['word']);
    if (!last.ok) return this.refused([last.problem]);
    const document = this.store.snapshot().document;
    const edited = document === null ? null : this.structure.withWordsAsOneScene(document, first.value.id, last.value.id);
    if (edited === null) {
      return this.refused([{ severity: 'error', message: `${last.value.ref} comes before ${first.value.ref}; give the caption's first word as \`from\`.`, ref: last.value.ref }]);
    }
    this.applyStructureEdit.execute(edited);
    return { ok: true, output: this.readout(first.value.id), problems: [] };
  }

  /** The ref and lines of the scene holding word `wordId`, as the store holds it now. */
  private readout(wordId: string): { caption: string; lines: CaptionLineReadout[] } | null {
    const segment = this.sceneHolding(this.store.snapshot().document, wordId);
    if (segment === undefined) return null;
    return {
      caption: this.parser.formatOf('segment', segment.id),
      lines: segment.lines.map((line) => ({ line: this.parser.formatOf('line', line.id), text: line.words.map((word) => word.text).join(' ') })),
    };
  }

  private sceneHolding(document: Document | null, wordId: string) {
    return document?.getSegments().find((segment) => segment.getWords().some((word) => word.id === wordId));
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
