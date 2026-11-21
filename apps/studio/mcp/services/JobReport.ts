import type { McpToolAnswer } from '@mcp/domain/McpTool';
import type { JobState } from '@mcp/services/BackgroundJob';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';

/**
 * Answers where a background job stands, in the words an agent acts on;
 * a result's pictures are shown as pictures.
 */
export class JobReport {
  constructor(private readonly answers: ToolAnswers) {}

  answer(jobId: string, state: JobState): McpToolAnswer {
    if (state.state === 'done') return this.answers.json(state.result, `Job ${jobId} (${state.kind}) is done.`);
    if (state.state === 'failed') return { ...this.answers.text(`Job ${jobId} (${state.kind}) failed: ${state.error.message}`), isError: true };
    const seconds = Math.round((Date.now() - state.startedAt) / 1000);
    return this.answers.text(`Job ${jobId} (${state.kind}) is still running after ${seconds} s. Call wait_for_job with job "${jobId}" to keep waiting.`);
  }
}
