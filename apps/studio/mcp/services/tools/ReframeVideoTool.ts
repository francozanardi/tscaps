import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { BackgroundJobs } from '@mcp/services/BackgroundJobs';
import type { JobReport } from '@mcp/services/JobReport';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const SUBJECT = {
  show: z.string().regex(/^[A-Ha-h]$/).optional().describe('The person the frame shows, by their letter on the take\'s picture.'),
  at: z.object({
    x: z.number().min(0).max(1).describe('Across the source picture: 0 its left edge, 1 its right. The ruler under each take\'s picture numbers the tenths.'),
    y: z.number().min(0).max(1).optional().describe('Down the source picture: 0 its top, 1 its bottom. Leave it out for the middle.'),
  }).optional().describe('A point of the picture to centre instead of a person: an object, a screen, someone the survey did not find.'),
  closeness: z.number().min(1).max(3).optional().describe('How close: 1 is the frame\'s own closeness. Leave it out: a person small in the picture is framed closer by measure.'),
  name: z.string().max(60).optional().describe('A short name for who or what is shown, for the report: "the host", "the rover".'),
};

const ARGS = z.object({
  format: z.enum(['9:16', '1:1', '4:5', '16:9']).default('9:16').describe('The new shape, width:height: 9:16 (Reels, TikTok, Shorts), 1:1 or 4:5 (feeds), 16:9 (YouTube).'),
  plan: z.array(z.object({
    take: z.number().int().min(0).describe('The take\'s number, as the survey numbers it.'),
    ...SUBJECT,
    switches: z.array(z.object({
      atSec: z.number().min(0).describe('When the frame changes to this subject, in seconds of the source video: the start of the phrase the other person says. The cut lands in the silence before the nearest word.'),
      ...SUBJECT,
    })).max(30).optional().describe('Changes of subject inside the take, in time order: a wide take of two people who both speak for a few seconds each.'),
  })).max(300).optional().describe('What each take shows: `show` (a person\'s letter) or `at` (a point), one of the two. Only the takes that need saying: one with a single person shows them, and one with nobody its middle.'),
  onlyPlanned: z.boolean().optional().describe('true: frame only the takes in `plan` and leave the others as they are. For a fix after the first reframe.'),
});

const REFRAME_TIMEOUT_MS = 60 * 60_000;
// Longer than the other tools wait: a call takes about half a minute on a short video without a GPU, and waiting it
// out saves the agent a turn. Still under the minute after which some clients give up on a tool.
const WAIT_MS = 50_000;
const HOW_TO_CHOOSE = [
  'Nothing was changed yet: a frame of this shape shows only part of the picture, and what some takes show is yours to choose (`problems`, when there, says what the editor could not do). Choose, then call reframe_video again with `plan`.',
  'The pictures show each take, numbered, with the people found in it boxed and lettered from left to right; `takes` lists them with what is said in each, phrase by phrase with its start time.',
  'For each take with several people, show whoever is speaking: work out who says what from the takes that show one person alone (the editor of the video cut to them while they spoke), from what is said (who asks, who answers, a name on screen) and from the order of the conversation.',
  'That reading of who speaks is a guess, good enough to choose a framing and nothing else: do not colour or style captions by it.',
  'Where both speak for about two seconds or more inside one take, add a switch at the start of the other\'s phrase; a word or two ("yeah", "right") is not worth a switch.',
  'A take with nobody in it is framed on the middle of the picture: look at where its subject is (the object, the hands, the screen) and, unless that is the middle, give the point with `at`, reading `x` off the ruler under the picture.',
  'A take with one person needs no entry, unless the survey missed or mistook someone: then give the point of the person to show with `at`.',
].join(' ');
const HOW_TO_CHECK = [
  'The pictures show one exported frame from the middle of each part, numbered as `parts` (a part whose camera follows its person has three, a to c).',
  'Look at each: the subject whole and near the middle, no head cut by an edge, the right person; a part that shows "the middle of the picture" was framed without a choice, so check that its subject is in it. Fix a part by calling reframe_video again with `onlyPlanned: true` and a `plan` entry for its take (another person, a point with `at`, another `closeness`); every switch of that take has to be given again.',
].join(' ');

/** `reframe_video`: the editor's reframe by survey, which frames by measure and asks only whom a take of several people shows. */
export class ReframeVideoTool implements McpTool {
  readonly name = 'reframe_video';
  readonly description = [
    'Make the video another shape filled to the frame (most often a wide video made vertical, 9:16) and frame every shot on what it should show.',
    'The editor does the looking that can be measured: it finds the takes (stretches filmed without a cut) and the people in each, opens a shot at every camera change, centres each take on its person with their head a third of the way down, closer where they are small, and follows a person who walks out of the framing.',
    'What it cannot measure is whom to show where a take holds several people. Call it first with only `format`: on a video where every take holds one person or nobody it reframes at once; otherwise it changes nothing and answers the takes, with pictures of them, the people lettered. Call it again with `plan` saying whom those takes show, all of them in one call.',
    'It answers the framed parts and pictures of them as they export: look at them, and fix a part with `onlyPlanned`.',
    'Use it, never set_output_frame, to fill a frame of another shape, and do it before camera moves.',
  ].join(' ');
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly jobs: BackgroundJobs,
    private readonly report: JobReport,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const params = this.args.read(ARGS, args);
    const job = await this.jobs.start('reframe_video', async () => this.explained(await this.pageCalls.callForJob('reframe_video', params, REFRAME_TIMEOUT_MS)), WAIT_MS);
    return this.report.answer(job.id, job.state);
  }

  /** The page's answer with what to do about it: choose whom the takes show, or check the result. */
  private explained(result: unknown): unknown {
    if (typeof result !== 'object' || result === null) return result;
    const answer = result as { readonly report?: { readonly framed?: unknown } };
    return { next: answer.report?.framed === false ? HOW_TO_CHOOSE : HOW_TO_CHECK, ...answer };
  }
}
