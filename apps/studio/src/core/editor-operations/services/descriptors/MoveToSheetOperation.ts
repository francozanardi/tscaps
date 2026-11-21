import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SceneRefsReader } from '@core/editor-operations/services/SceneRefsReader';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { AssignSelectedSegmentsSheetAction } from '@core/sheets/actions/AssignSelectedSegmentsSheetAction';

const MAX_SCENES = 200;

/**
 * `move_to_sheet`: moves scenes onto another caption style sheet, as
 * picking a sheet for a scene selection in the transcript does. Every
 * ref is checked before anything moves.
 */
export class MoveToSheetOperation implements EditorOperation {
  readonly name = 'move_to_sheet';
  readonly effect = 'edit';
  readonly description = [
    'Move scenes (segments) onto another caption style sheet, so they take its look; `sheet:main` takes them back to the main look.',
    'Moved scenes are laid out again under the sheet\'s rules, so their refs can change (answered as a warning). Answers how many scenes moved; a scene already on that sheet does not count.',
  ].join(' ');

  private readonly input = new OperationInput({
    segments: z.array(z.string()).min(1).max(MAX_SCENES).describe('The scenes, as refs: segment:<id>.'),
    sheet: z.string().describe('The sheet to move them onto, as a ref: sheet:<id>.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly sheets: SheetRefResolver,
    private readonly scenes: SceneRefsReader,
    private readonly reflow: CaptionReflowDetector,
    private readonly assignScenes: AssignSelectedSegmentsSheetAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const sheet = this.sheets.resolve(checked.value.sheet);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const reading = this.scenes.read(checked.value.segments);
    if (!reading.ok) return this.refused(reading.problems);
    const before = this.store.snapshot().document;
    const moved = this.assignScenes.execute(sheet.value.id, new Set(reading.scenes.map((scene) => scene.id))).movedCount;
    const reflowed = this.reflow.warningFor(before, this.store.snapshot().document);
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheet.value.id), scenesMoved: moved },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
