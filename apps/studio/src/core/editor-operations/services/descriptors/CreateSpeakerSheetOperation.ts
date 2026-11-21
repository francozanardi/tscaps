import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { CreateSpeakerSheetAction } from '@core/sheets/actions/CreateSpeakerSheetAction';
import type { RenameSheetAction } from '@core/sheets/actions/RenameSheetAction';
import type { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import type { SheetCreationOption } from '@core/sheets/domain/SheetCreationOption';
import type { SheetCreationOptionFinder } from '@core/sheets/services/SheetCreationOptionFinder';

const MAX_NAME_CHARS = 40;

type SpeakerOption = Extract<SheetCreationOption, { kind: 'speaker' }>;

/**
 * `create_speaker_sheet`: gives one voice of the transcript a caption
 * style sheet of its own and moves its words onto it, as the sidebar's
 * "+" does for a speaker: the main sheet's look on another colour preset,
 * linked to the main sheet so later style edits reach both. The first
 * voice stays on the main sheet. The sheet the person had on screen stays
 * the one on screen.
 */
export class CreateSpeakerSheetOperation implements EditorOperation {
  readonly name = 'create_speaker_sheet';
  readonly effect = 'edit';
  readonly description = [
    'Give one speaker their own caption style, so viewers can tell the voices apart: their words move to a new sheet with the main sheet\'s look on another colour preset, linked to the main sheet so later style edits change both.',
    'The first voice keeps the main sheet; call it once for each other voice. Speaker ids come from get_transcript (each segment\'s speaker). A scene two voices share is split between them.',
    'Answers the new sheet\'s ref; its scenes are laid out again, so their refs can change (answered as a warning).',
  ].join(' ');

  private readonly input = new OperationInput({
    speaker: z.string().describe('The speaker id, as get_transcript shows it.'),
    name: z.string().trim().min(1).max(MAX_NAME_CHARS).optional().describe('The sheet\'s name, such as the speaker\'s name when the transcript says it. "Speaker 2" and so on when left out.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly reflow: CaptionReflowDetector,
    private readonly options: SheetCreationOptionFinder,
    private readonly createSpeakerSheet: CreateSpeakerSheetAction,
    private readonly rename: RenameSheetAction,
    private readonly setActiveSheet: SetActiveSheetAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const before = this.store.snapshot();
    const offered = this.speakerOptions();
    const option = offered.find((candidate) => candidate.speakerId === checked.value.speaker);
    if (option === undefined) return this.refused([this.notOffered(checked.value.speaker, offered)]);

    const sheetId = this.createSpeakerSheet.execute(option.speakerId, option.name, option.position);
    if (sheetId === null) return this.refused([{ severity: 'error', message: 'The project has no main sheet to copy.' }]);
    if (checked.value.name !== undefined) this.rename.execute(sheetId, checked.value.name);
    if (before.activeSheetId !== null) this.setActiveSheet.execute(before.activeSheetId);
    const reflowed = this.reflow.warningFor(before.document, this.store.snapshot().document);
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheetId), speaker: option.speakerId, name: checked.value.name ?? option.name },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  private speakerOptions(): SpeakerOption[] {
    const { document, sheets } = this.store.snapshot();
    return this.options.find(document, sheets).filter((option): option is SpeakerOption => option.kind === 'speaker');
  }

  private notOffered(speaker: string, offered: ReadonlyArray<SpeakerOption>): OperationProblem {
    const others = offered.map((option) => option.speakerId).join(', ');
    return {
      severity: 'error',
      message: offered.length === 0
        ? `No voice can get a sheet of its own: the transcript has fewer than two speakers, or every voice past the first already has one.`
        : `Speaker "${speaker}" cannot get a sheet of its own: it is the first voice (which keeps the main sheet), already has one, or is not in the transcript. Voices that can: ${others}.`,
    };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
