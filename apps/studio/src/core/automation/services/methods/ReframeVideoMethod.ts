import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import { OutputFrame, type OutputFrameFormat } from '@core/output-frame/domain/OutputFrame';
import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import { TAKE_PLAN, type TakeChoiceReader } from '@core/reframe/services/TakeChoiceReader';
import type { SurveyReframeReadout } from '@core/reframe/services/SurveyReframeReadout';
import type { SurveyReframeWorkflow } from '@core/reframe/services/SurveyReframeWorkflow';

const FORMATS = OutputFrame.formats().filter((format) => format !== 'original') as [OutputFrameFormat, ...OutputFrameFormat[]];

const PARAMS = z.object({
  format: z.enum(FORMATS).default('9:16'),
  plan: TAKE_PLAN.optional(),
  onlyPlanned: z.boolean().optional(),
});

/**
 * `reframe_video`: makes the video another shape, filled, and frames
 * every shot by measure on the people found in its take. A take with
 * several people needs `plan` to say whom it shows: called without one
 * on such a video, or where the people could not be looked at, it
 * changes nothing and answers the survey (each take, its people by
 * letter, what is said in it) with pictures of the takes, the people
 * marked. Otherwise it answers what it framed with pictures
 * of the result as it exports, one per part as numbered. All its changes
 * make one checkpoint. Pictures are base64 JPEG.
 */
export class ReframeVideoMethod implements AutomationMethod {
  readonly name = 'reframe_video';

  constructor(
    private readonly workflow: SurveyReframeWorkflow,
    private readonly readout: SurveyReframeReadout,
    private readonly params: AutomationParamsReader,
    private readonly choices: TakeChoiceReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { format, plan, onlyPlanned } = this.params.read(this.name, PARAMS, params);
    const read = plan === undefined ? null : this.choices.read(plan);
    if (read !== null && !read.ok) throw new AutomationCallFailedError(this.name, read.problem);
    const outcome = await this.workflow.run(
      { format, choices: read === null ? null : read.choices, onlyChosen: onlyPlanned === true },
      {
        historyGroup: { key: `automation:reframe:${crypto.randomUUID()}`, author: 'assistant' },
        signal: new AbortController().signal,
        progress: { report: () => undefined },
      },
    );
    if (outcome.kind === 'failed') throw new AutomationCallFailedError(this.name, outcome.problems.join(' '));
    if (outcome.kind === 'choose') return { report: this.readout.survey(outcome.surveys, outcome.warnings), pictures: this.picturesOf(outcome.sheets) };
    return { report: this.readout.report(outcome.report), pictures: this.picturesOf(outcome.report.sheets) };
  }

  private picturesOf(sheets: ReadonlyArray<EncodedPicture>): Array<{ mediaType: string; base64: string }> {
    return sheets.map((sheet) => ({ mediaType: sheet.mediaType, base64: sheet.base64 }));
  }
}
