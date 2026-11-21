import { z } from 'zod';
import type { ApplyStructureEditAction } from '@core/captions/actions/segments/ApplyStructureEditAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

/**
 * `join_captions`: makes a scene and the one after it a single scene, as
 * Delete at the end of a scene in the transcript does. Each keeps its
 * lines, so the joined scene shows them one under the other. The earlier
 * scene's sheet wins when the two were on different sheets.
 */
export class JoinCaptionsOperation implements EditorOperation {
  readonly name = 'join_captions';
  readonly effect = 'edit';
  readonly description = [
    'Join a caption (scene) with the one right after it, so they show as one: each keeps its own line(s), one under the other.',
    'When they were on different sheets, the joined caption takes the first one\'s. Words keep their text and times. Answers the joined scene\'s ref.',
  ].join(' ');

  private readonly input = new OperationInput({
    segment: z.string().describe('The first of the two captions, as a ref: segment:<id>.'),
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
    const edited = document === null ? null : this.structure.joinWithNext(document, scene.value.id);
    if (edited === null) return this.refused([{ severity: 'error', message: `${scene.value.ref} is the last caption; there is none after it to join.`, ref: scene.value.ref }]);
    this.applyStructureEdit.execute(edited);
    return { ok: true, output: { caption: this.parser.formatOf('segment', scene.value.id) }, problems: [] };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
