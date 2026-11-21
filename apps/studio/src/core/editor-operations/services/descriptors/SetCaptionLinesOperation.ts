import { z } from 'zod';
import type { Document } from '@tscaps/engine';
import type { ApplyStructureEditAction } from '@core/captions/actions/segments/ApplyStructureEditAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionElement, CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

/** One line of a caption as the answer gives it back. */
interface CaptionLineReadout {
  readonly line: string;
  readonly text: string;
}

/**
 * `set_caption_lines`: decides which words start each line of one scene,
 * as the transcript's line breaks and line joins do. Words
 * keep their text and times, and the scene keeps the lines through later
 * style changes.
 */
export class SetCaptionLinesOperation implements EditorOperation {
  readonly name = 'set_caption_lines';
  readonly effect = 'edit';
  readonly description = [
    'Set where the lines of one caption (scene) break: each word in `lineStarts` starts a new line, and the rest stay on the line before them; `[]` puts the whole caption on one line.',
    'For a caption set apart, whose lines each get a look of their own. The caption shows all its lines at once, so join its words into one caption first (join_captions) when they are spread over several.',
    'Words keep their text and times, and the caption keeps these lines when the style changes later. Answers each line\'s ref and text.',
  ].join(' ');

  private readonly input = new OperationInput({
    segment: z.string().describe('The caption, as a ref: segment:<id>.'),
    lineStarts: z.array(z.string()).describe('The words that start the second line, the third and so on, as refs (word:<id>), all in this caption and none its first word.'),
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
    const scene = this.captions.resolve(checked.value.segment, ['segment']);
    if (!scene.ok) return this.refused([scene.problem]);
    const document = this.store.snapshot().document;
    if (document === null) return this.refused([{ severity: 'error', message: 'There are no captions yet.' }]);
    const starts = this.resolveLineStarts(document, scene.value, checked.value.lineStarts);
    if (!starts.ok) return this.refused(starts.problems);
    const edited = this.structure.withLineStarts(document, scene.value.id, starts.wordIds);
    if (edited === null) return this.refused([{ severity: 'error', message: `${scene.value.ref} is gone; read the transcript again.`, ref: scene.value.ref }]);
    this.applyStructureEdit.execute(edited);
    return { ok: true, output: { caption: scene.value.ref, lines: this.linesOf(scene.value.id) }, problems: [] };
  }

  /** The word ids `refs` name, or the problems with them: a ref that is not a word of `scene`, or names its first word. */
  private resolveLineStarts(
    document: Document,
    scene: CaptionElement,
    refs: ReadonlyArray<string>,
  ): { ok: true; wordIds: string[] } | { ok: false; problems: OperationProblem[] } {
    const sceneWords = document.getSegments().find((segment) => segment.id === scene.id)?.getWords() ?? [];
    const problems: OperationProblem[] = [];
    const wordIds: string[] = [];
    for (const ref of refs) {
      const word = this.captions.resolve(ref, ['word']);
      if (!word.ok) {
        problems.push(word.problem);
        continue;
      }
      const index = sceneWords.findIndex((sceneWord) => sceneWord.id === word.value.id);
      if (index < 0) problems.push({ severity: 'error', message: `${word.value.ref} is not in ${scene.ref}.`, ref: word.value.ref });
      else if (index === 0) problems.push({ severity: 'error', message: `${word.value.ref} is the first word of ${scene.ref}: it always starts the first line.`, ref: word.value.ref });
      else wordIds.push(word.value.id);
    }
    return problems.length > 0 ? { ok: false, problems } : { ok: true, wordIds };
  }

  /** The lines of scene `segmentId` as the store holds them now. */
  private linesOf(segmentId: string): CaptionLineReadout[] {
    const segment = this.store.snapshot().document?.getSegments().find((candidate) => candidate.id === segmentId);
    if (segment === undefined) return [];
    return segment.lines.map((line) => ({ line: this.parser.formatOf('line', line.id), text: line.words.map((word) => word.text).join(' ') }));
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
