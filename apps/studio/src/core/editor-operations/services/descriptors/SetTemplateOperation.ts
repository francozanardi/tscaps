import { z } from 'zod';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { TemplateSwitchReadout } from '@core/editor-operations/services/TemplateSwitchReadout';
import type { SetTemplateAction } from '@core/sheets/actions/SetTemplateAction';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

const LISTED_AT_MOST = 15;

/**
 * `set_template`: applies a caption template to a style sheet, the
 * active one or any other, as picking it in the Templates tab does. The
 * templates are the gallery the editor offers in this session and the
 * person's own saved ones.
 *
 * A template that puts captions behind the person is refused unless the
 * sheet already wears it: picking one makes the editor ask the person,
 * in a dialog, to analyse the video first, and an operation must not
 * open one.
 */
export class SetTemplateOperation implements EditorOperation {
  readonly name = 'set_template';
  readonly effect = 'edit';
  readonly description = [
    'Apply a caption template (a complete look: fonts, colours, layout, animations) to a style sheet: the active one, or the one `sheet` names. Template ids come from list_catalog.',
    'It starts the sheet over on the template: its style controls, typography, position, effects, CSS and animations go back to the template\'s (the answer says what that undid), and the per-element styles and behind-the-person settings of every caption under the sheet are cleared.',
    'Scenes are laid out again by the template\'s rules, which can change segment refs and the suggested emojis (answered as a warning). Sheets linked to it (one per speaker) switch too.',
  ].join(' ');

  private readonly input = new OperationInput({
    template: z.string().describe('The template id, as list_catalog lists it.'),
    sheet: z.string().optional().describe('The sheet, as a ref: sheet:<id>. The active sheet when left out.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly sheets: SheetRefResolver,
    private readonly store: EditorStore,
    private readonly userTemplates: UserTemplatesStore,
    private readonly parser: EditorRefParser,
    private readonly activeSheetEdits: ActiveSheetEditRunner,
    private readonly setTemplate: SetTemplateAction,
    private readonly reflow: CaptionReflowDetector,
    private readonly switches: TemplateSwitchReadout,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const sheet = this.sheets.resolve(checked.value.sheet);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const templates = this.offeredTemplates();
    const template = templates.find((candidate) => candidate.metadata.id === checked.value.template);
    if (template === undefined) return this.refused([this.unknownTemplate(checked.value.template, templates)]);
    const needsAnalysis = this.needsPersonAnalysis(sheet.value, template);
    if (needsAnalysis !== null) return this.refused([needsAnalysis]);

    const before = this.store.snapshot();
    this.activeSheetEdits.runOn(sheet.value.id, () => this.setTemplate.execute(template));
    const after = this.store.snapshot();
    const switched = this.sheetsSwitched(before, after).filter((id) => id !== sheet.value.id);
    return {
      ok: true,
      output: {
        sheet: this.parser.formatOf('sheet', sheet.value.id),
        template: template.metadata.id,
        ...(switched.length > 0 ? { linkedSheetsSwitched: switched.map((id) => this.parser.formatOf('sheet', id)) } : {}),
      },
      problems: this.warnings(before, after),
    };
  }

  /** The gallery offered in this session, then the person's saved templates. */
  private offeredTemplates(): ReadonlyArray<Template> {
    return [
      ...this.store.snapshot().availableTemplates,
      ...this.userTemplates.snapshot().map((saved) => saved.template),
    ];
  }

  private unknownTemplate(id: string, templates: ReadonlyArray<Template>): OperationProblem {
    const ids = templates.map((template) => template.metadata.id);
    const shown = ids.slice(0, LISTED_AT_MOST).join(', ');
    const more = ids.length > LISTED_AT_MOST ? ', … (list_catalog for all)' : '';
    return { severity: 'error', message: `No template is named "${id}". Templates: ${shown}${more}.` };
  }

  /** The refusal for a template that would make the editor ask to analyse the video, or null. */
  private needsPersonAnalysis(sheet: Sheet, template: Template): OperationProblem | null {
    if (!template.behindActor.required || sheet.template.metadata.id === template.metadata.id) return null;
    return {
      severity: 'error',
      message: `${template.metadata.name} puts captions behind the person, which needs the video analysed first with the person's consent: ask them to pick it in the Templates tab. To put chosen scenes behind the person on the current template, use set_caption_element_effects.`,
    };
  }

  /** The ids of the sheets that wear another template than before. */
  private sheetsSwitched(before: EditorState, after: EditorState): string[] {
    const templateBefore = new Map(before.sheets.map((sheet) => [sheet.id, sheet.template]));
    return after.sheets
      .filter((sheet) => templateBefore.get(sheet.id) !== sheet.template)
      .map((sheet) => sheet.id);
  }

  private warnings(before: EditorState, after: EditorState): OperationProblem[] {
    const warnings: OperationProblem[] = this.undoneOn(before, after);
    if (after.elementStyles !== before.elementStyles || after.behindActorOverrides !== before.behindActorOverrides) {
      warnings.push({
        severity: 'warning',
        message: 'The per-element styles and behind-the-person settings of the captions under this sheet were cleared.',
      });
    }
    const reflowed = this.reflow.warningFor(before.document, after.document);
    if (reflowed !== null) warnings.push(reflowed);
    return warnings;
  }

  /** For each sheet that switched, what had been set on it and the new template does not keep. */
  private undoneOn(before: EditorState, after: EditorState): OperationProblem[] {
    return after.sheets.flatMap((sheet) => {
      const was = before.sheets.find((candidate) => candidate.id === sheet.id);
      if (was === undefined || was.template === sheet.template) return [];
      const undone = this.switches.undone(was, sheet);
      if (undone.length === 0) return [];
      const ref = this.parser.formatOf('sheet', sheet.id);
      return [{ severity: 'warning' as const, message: `${ref} is on ${sheet.template.metadata.id} now, which undid what had been set on it: ${undone.join(', ')}.` }];
    });
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
