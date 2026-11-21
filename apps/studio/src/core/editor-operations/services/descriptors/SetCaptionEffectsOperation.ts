import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { UpdateEffectsAction } from '@core/sheets/actions/style/UpdateEffectsAction';
import type { Sheet } from '@core/sheets/domain/Sheet';

const EMOJI_PLACEMENTS = ['word', 'segment-above', 'segment-below', 'segment-around'] as const;

/**
 * `set_caption_effects`: turns a caption style sheet's effects on or off,
 * as the Effects tab does: the emojis transcription suggested, where
 * emojis sit, lowercase, and punctuation. Sheets linked to it follow.
 */
export class SetCaptionEffectsOperation implements EditorOperation {
  readonly name = 'set_caption_effects';
  readonly effect = 'edit';
  readonly description = [
    'Turn a caption style sheet\'s effects on or off: the active sheet, or the one `sheet` names. Give only what changes.',
    '`automaticEmojis` shows the suggested emojis: one per caption so they never crowd it, picked for how the template lays the captions out, so another template or layout suggests others (get_transcript marks them suggested). Emojis added with set_emoji show either way, in place of their caption\'s suggestion. Use it to show the suggestions instead of setting each one by hand.',
    '`emojiPlacement` is where every emoji of the sheet sits: by its word, above or below the caption, or alternating. `lowercase` writes the captions in lowercase (keeping "I"); `removePunctuation` drops the trailing punctuation of words.',
  ].join(' ');

  private readonly input = new OperationInput({
    sheet: z.string().optional().describe('The sheet, as a ref: sheet:<id>. The active sheet when left out.'),
    automaticEmojis: z.boolean().optional().describe('Show the emojis transcription suggested.'),
    emojiPlacement: z.enum(EMOJI_PLACEMENTS).optional().describe('word: beside its word; segment-above or segment-below: above or below the caption; segment-around: each caption picks a side.'),
    lowercase: z.boolean().optional().describe('Write the captions in lowercase.'),
    removePunctuation: z.boolean().optional().describe('Drop the punctuation at the end of words.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly sheets: SheetRefResolver,
    private readonly activeSheetEdits: ActiveSheetEditRunner,
    private readonly updateEffects: UpdateEffectsAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { automaticEmojis, emojiPlacement, lowercase, removePunctuation } = checked.value;
    const sheet = this.sheets.resolve(checked.value.sheet);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const updates = this.updatesFor(sheet.value, { automaticEmojis, emojiPlacement, lowercase, removePunctuation });
    if (!updates.ok) return this.refused(updates.problems);
    if (updates.configs.length === 0) return this.refused([this.error('Give at least one of automaticEmojis, emojiPlacement, lowercase or removePunctuation.')]);
    this.activeSheetEdits.runOn(sheet.value.id, () => {
      for (const config of updates.configs) this.updateEffects.execute(config);
    });
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheet.value.id), changed: updates.configs.map((config) => config.type) },
      problems: automaticEmojis === true && !this.hasSuggestedEmojis() ? [this.noSuggestions()] : [],
    };
  }

  /** The effect configs of `sheet` the request changes, each as it should become. */
  private updatesFor(
    sheet: Sheet,
    wanted: { automaticEmojis: boolean | undefined; emojiPlacement: (typeof EMOJI_PLACEMENTS)[number] | undefined; lowercase: boolean | undefined; removePunctuation: boolean | undefined },
  ): { ok: true; configs: EffectConfig[] } | { ok: false; problems: OperationProblem[] } {
    const configs: EffectConfig[] = [];
    const problems: OperationProblem[] = [];
    const emoji = sheet.effectConfig('emoji');
    if (wanted.automaticEmojis !== undefined || wanted.emojiPlacement !== undefined) {
      if (emoji === null) problems.push(this.error('This sheet has no emoji settings.'));
      else configs.push({ ...emoji, enabled: wanted.automaticEmojis ?? emoji.enabled, placement: wanted.emojiPlacement ?? emoji.placement });
    }
    for (const [type, enabled] of [['smart_lowercase', wanted.lowercase], ['remove_punctuation', wanted.removePunctuation]] as const) {
      if (enabled === undefined) continue;
      const config = sheet.effectConfig(type);
      if (config === null) problems.push(this.error(`This sheet has no ${type.replace('_', ' ')} setting.`));
      else configs.push({ ...config, enabled });
    }
    return problems.length > 0 ? { ok: false, problems } : { ok: true, configs };
  }

  private hasSuggestedEmojis(): boolean {
    return this.store.snapshot().document?.getWords().some((word) => word.decoration !== null) ?? false;
  }

  private noSuggestions(): OperationProblem {
    return {
      severity: 'warning',
      message: 'Transcription suggested no emoji in this project, so nothing new shows. Add emojis to chosen words with set_emoji.',
    };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
