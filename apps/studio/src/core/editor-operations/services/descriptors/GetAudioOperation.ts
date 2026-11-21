import { z } from 'zod';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { AudioLevelsReader } from '@core/editor-operations/services/AudioLevelsReader';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

const MAX_RANGE_SEC = 60;
const FINE_RANGE_SEC = 20;
const FINE_BIN_SEC = 0.05;
const COARSE_BIN_SEC = 0.1;
// Shorter quiet than this is the gap inside a word ("t", "p"), not a pause.
const MIN_QUIET_SEC = 0.08;

/**
 * `get_audio`: how loud the video's sound is over a stretch, as a row of
 * digits, where it is quiet, and the transcript's words over the same
 * stretch, so a cut can be placed in real quiet rather than by the
 * words' approximate times.
 */
export class GetAudioOperation implements EditorOperation {
  readonly name = 'get_audio';
  readonly effect = 'read';
  readonly description = [
    'Read the sound of the source video over a stretch (up to 60 s): `levels` holds one digit per `binSec` (0.05 s up to 20 s, 0.1 s beyond), 0 where it is quiet, 1 to 9 from barely audible to the voice\'s full level;',
    '`quiet` lists the stretches where it really is quiet, and `words` the transcript\'s words over the same stretch as [ref, text, startSec, endSec].',
    'A level says how loud, not what: music or noise reads like a word. So the words say where the pauses are, and the sound says where a word really ends: their times are approximate and can be off by a tenth of a second or more.',
    'Read it before cutting a pause or a word by hand, and keep each cut edge inside the pause the words leave and inside quiet.',
    'Levels that never fall to 0 between the words mean music or noise under the voice over that stretch; `background: "steady"`, under it through the whole video. Either way a cut there makes that sound jump and hides where words end: leave it uncut unless the person asks for it knowing that.',
  ].join(' ');

  private readonly input = new OperationInput({
    fromSec: z.number().min(0).describe('Start of the stretch, in seconds of the source video.'),
    toSec: z.number().min(0).describe(`End of the stretch, in seconds of the source video; at most ${MAX_RANGE_SEC} s after fromSec.`),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly audio: AudioLevelsReader,
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { fromSec, toSec } = checked.value;
    if (!(toSec > fromSec)) return this.refusedFor('toSec must be after fromSec.');
    if (toSec - fromSec > MAX_RANGE_SEC) return this.refusedFor(`Read at most ${MAX_RANGE_SEC} s at a time.`);
    const levels = await this.audio.read();
    if (levels === null) return this.refusedFor('The video\'s sound cannot be read: its file is not loaded yet, or it has no sound.');
    const range: CutRange = { startSec: fromSec, endSec: Math.min(toSec, levels.durationSec) };
    if (!(range.endSec > range.startSec)) return this.refusedFor(`The video's sound ends at ${this.format.sec(levels.durationSec)} s.`);
    const binSec = range.endSec - range.startSec > FINE_RANGE_SEC ? COARSE_BIN_SEC : FINE_BIN_SEC;
    return {
      ok: true,
      output: {
        fromSec: this.format.sec(range.startSec),
        toSec: this.format.sec(range.endSec),
        binSec,
        levels: levels.digits(range, binSec),
        quiet: levels.quietSpans(MIN_QUIET_SEC)
          .filter((span) => span.endSec > range.startSec && span.startSec < range.endSec)
          .map((span) => [this.format.sec(span.startSec), this.format.sec(span.endSec)]),
        words: this.wordsIn(range),
        ...(levels.hasSteadyBackground ? { background: 'steady' } : {}),
      },
      problems: [],
    };
  }

  private wordsIn(range: CutRange): Array<[string, string, number, number]> {
    return (this.store.snapshot().document?.getWords() ?? [])
      .filter((word) => word.time.end > range.startSec && word.time.start < range.endSec)
      .map((word) => [this.parser.formatOf('word', word.id), word.text, this.format.sec(word.time.start), this.format.sec(word.time.end)]);
  }

  private refusedFor(message: string): OperationResult {
    return this.refused([{ severity: 'error', message }]);
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
