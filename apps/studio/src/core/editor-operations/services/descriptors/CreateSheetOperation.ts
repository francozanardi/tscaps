import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SceneRefsReader } from '@core/editor-operations/services/SceneRefsReader';
import type { AssignSelectedSegmentsSheetAction } from '@core/sheets/actions/AssignSelectedSegmentsSheetAction';
import type { CreateSheetAction } from '@core/sheets/actions/CreateSheetAction';
import type { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';

const MAX_NAME_CHARS = 40;
const MAX_SCENES = 200;

/**
 * `create_sheet`: adds a caption style sheet, a copy of the main one,
 * and moves the scenes it is given onto it. The sheet the person had on
 * screen stays the one on screen.
 */
export class CreateSheetOperation implements EditorOperation {
  /** What the description gives as captions worth a look of their own. */
  static readonly EXAMPLE_USES = '(a quote, a list, a second speaker)';

  readonly name = 'create_sheet';
  readonly effect = 'edit';
  readonly description = [
    'Add a caption style sheet: a copy of the main sheet, named `name`, and move the scenes in `segments` onto it.',
    'Use it to give some captions a look of their own ' + CreateSheetOperation.EXAMPLE_USES + ' while the rest keep theirs; then change the new sheet with set_template, set_caption_typography, set_caption_position, set_style_controls or set_sheet_css, naming it with `sheet`. For the opening captions use set_hook_captions instead.',
    'Answers the new sheet\'s ref. Moved scenes are laid out again under the sheet\'s rules, so their refs can change (answered as a warning).',
  ].join(' ');

  private readonly input = new OperationInput({
    name: z.string().trim().min(1).max(MAX_NAME_CHARS).describe('The sheet\'s name, as the person will see it in the sidebar (e.g. "Quotes").'),
    segments: z.array(z.string()).max(MAX_SCENES).optional().describe('The scenes to move onto it, as refs: segment:<id>. Left out, the sheet starts empty.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly scenes: SceneRefsReader,
    private readonly reflow: CaptionReflowDetector,
    private readonly createSheet: CreateSheetAction,
    private readonly setActiveSheet: SetActiveSheetAction,
    private readonly assignScenes: AssignSelectedSegmentsSheetAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const reading = this.scenes.read(checked.value.segments ?? []);
    if (!reading.ok) return this.refused(reading.problems);
    const before = this.store.snapshot();
    const sheetId = this.createSheet.execute(checked.value.name);
    if (sheetId === null) return this.refused([{ severity: 'error', message: 'The project has no main sheet to copy.' }]);
    if (before.activeSheetId !== null) this.setActiveSheet.execute(before.activeSheetId);
    const moved = reading.scenes.length === 0 ? 0 : this.assignScenes.execute(sheetId, new Set(reading.scenes.map((scene) => scene.id))).movedCount;
    const reflowed = this.reflow.warningFor(before.document, this.store.snapshot().document);
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheetId), name: checked.value.name, scenesMoved: moved },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
