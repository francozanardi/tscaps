import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SceneRefsReader } from '@core/editor-operations/services/SceneRefsReader';
import type { SetHookScenesAction } from '@core/sheets/actions/SetHookScenesAction';
import type { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { SHEET_ROLES } from '@core/sheets/domain/SheetRole';

const MAX_SCENES = 50;

/**
 * `set_hook_captions`: puts the video's opening scenes on the hook sheet,
 * a caption style made to make the opening line stand out, as "Set hook
 * scenes" in the transcript does. The scenes must be the first ones, with
 * no gap. An empty list takes them back to the main sheet and removes the
 * hook sheet. The sheet the person had on screen stays the one on screen.
 */
export class SetHookCaptionsOperation implements EditorOperation {
  readonly name = 'set_hook_captions';
  readonly effect = 'edit';
  readonly description = [
    'Give the opening captions (the hook) a look of their own: the scenes in `segments` move to the hook sheet, which is created with a template made for hooks the first time.',
    'The scenes must be the video\'s first ones, in a row from the start. They replace the hook\'s scenes; an empty list takes them back to the main sheet and removes the hook sheet.',
    'Change the hook\'s look afterwards with set_template or the other sheet tools on the sheet this answers. Its scenes are laid out again, so their refs can change (answered as a warning).',
  ].join(' ');

  private readonly input = new OperationInput({
    segments: z.array(z.string()).max(MAX_SCENES).describe('The opening scenes, as refs: segment:<id>, the first one onward. [] removes the hook.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly scenes: SceneRefsReader,
    private readonly reflow: CaptionReflowDetector,
    private readonly setHookScenes: SetHookScenesAction,
    private readonly setActiveSheet: SetActiveSheetAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const reading = this.scenes.read(checked.value.segments);
    if (!reading.ok) return this.refused(reading.problems);
    const ids = reading.scenes.map((scene) => scene.id);
    const gap = this.gapIn(ids);
    if (gap !== null) return this.refused([gap]);
    const before = this.store.snapshot();
    this.setHookScenes.execute(new Set(ids));
    const after = this.store.snapshot();
    if (before.activeSheetId !== null && after.sheets.some((sheet) => sheet.id === before.activeSheetId)) this.setActiveSheet.execute(before.activeSheetId);
    const hookSheetId = SHEET_ROLES.hook.sheetId;
    const reflowed = this.reflow.warningFor(before.document, after.document);
    return {
      ok: true,
      output: ids.length === 0
        ? { hook: null }
        : { hook: this.parser.formatOf('sheet', hookSheetId), scenes: reading.scenes.map((scene) => scene.ref) },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  /** Why `ids` are not the video's opening scenes in a row, or null when they are. */
  private gapIn(ids: ReadonlyArray<string>): OperationProblem | null {
    const document = this.store.snapshot().document;
    if (document === null) return { severity: 'error', message: 'The project has no captions yet.' };
    const opening = document.sections.flatMap((section) => section.segments.map((segment) => segment.id)).slice(0, ids.length);
    const wanted = new Set(ids);
    if (opening.every((id) => wanted.has(id))) return null;
    const firstMissing = opening.find((id) => !wanted.has(id)) ?? '';
    return {
      severity: 'error',
      message: `The hook must be the video's first ${ids.length} scene(s) in a row; ${this.parser.formatOf('segment', firstMissing)} comes before some of them and is not in the list. Read the transcript for the opening scenes.`,
    };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
