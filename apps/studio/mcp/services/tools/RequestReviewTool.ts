import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';

// The page waits this long for a batch: under every client's tool-call timeout.
const WAIT_SEC = 25;
const CALL_TIMEOUT_MS = 60_000;

/** What the page answers: the notes sent since the last call, or that the person is still reviewing. */
type ReviewAnswer =
  | { readonly reviewing: true; readonly drafts: number }
  | { readonly notes: ReadonlyArray<number>; readonly text: string; readonly stillOpen?: ReadonlyArray<number>; readonly pictures: ReadonlyArray<unknown> };

/** `request_review`: the person's review notes, sent from the page, as one batch. */
export class RequestReviewTool implements McpTool {
  readonly name = 'request_review';
  readonly description = [
    'The notes the person left on the video for you, as they sent them from the editor page (Send to agent): what each asks, at what moment, what is under it, and a picture of each marked moment with the marks drawn on it.',
    'Call it after showing the person a change, to know what to fix: it waits up to about 25 seconds for them to send; while they are still reviewing it says so, and you call it again (tell the person they can send their notes from the page).',
    'Each note has a number. Do what the notes ask, look at the result, then resolve_notes with the numbers you did, and say note by note what you did and why for any you left.',
  ].join(' ');
  readonly inputSchema = { type: 'object', properties: {} };

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
  ) {}

  async run(): Promise<McpToolAnswer> {
    const answer = (await this.pageCalls.call('request_review', { waitSec: WAIT_SEC }, CALL_TIMEOUT_MS)) as ReviewAnswer;
    if ('reviewing' in answer) {
      const drafts = answer.drafts === 0 ? 'no notes written yet' : `${answer.drafts} ${answer.drafts === 1 ? 'note' : 'notes'} written and not sent yet`;
      return this.answers.text(`The person is still reviewing (${drafts}). Call request_review again to keep waiting, or answer them in the chat.`);
    }
    const { text, ...rest } = answer;
    return this.answers.json(rest, text);
  }
}
