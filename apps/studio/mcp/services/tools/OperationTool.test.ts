import { describe, expect, it } from 'vitest';
import type { ListedOperation } from '@mcp/domain/ListedOperation';
import type { PageCalls } from '@mcp/services/PageCalls';
import { ToolAnswers } from '@mcp/services/ToolAnswers';
import { OperationTool } from '@mcp/services/tools/OperationTool';

/** Records what the tool sends to the page, and answers what an operation answers. */
class RecordingPageCalls {
  readonly calls: Array<{ method: string; params: unknown }> = [];

  constructor(private readonly result: unknown) {}

  async call(method: string, params: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    return this.result;
  }
}

function operation(effect: 'read' | 'edit'): ListedOperation {
  return {
    name: effect === 'edit' ? 'set_timing' : 'get_transcript',
    description: 'An operation.',
    effect,
    inputSchema: { type: 'object', properties: { fromSec: { type: 'number' } }, required: ['fromSec'], additionalProperties: false },
  };
}

describe('OperationTool', () => {
  it('offers an edit with its own schema and a checkpoint key, and a read with its schema as it is', () => {
    const page = new RecordingPageCalls({ ok: true });
    const edit = new OperationTool(operation('edit'), page as unknown as PageCalls, new ToolAnswers());
    const read = new OperationTool(operation('read'), page as unknown as PageCalls, new ToolAnswers());

    expect(edit.name).toBe('set_timing');
    expect(Object.keys(edit.inputSchema['properties'] as object)).toEqual(['fromSec', 'checkpoint']);
    expect(edit.inputSchema['required']).toEqual(['fromSec']);
    expect(Object.keys(read.inputSchema['properties'] as object)).toEqual(['fromSec']);
  });

  it('runs the operation in the page with its input, the checkpoint apart, and marks a refusal as an error', async () => {
    const page = new RecordingPageCalls({ ok: false, problems: [{ message: 'gone' }] });
    const tool = new OperationTool(operation('edit'), page as unknown as PageCalls, new ToolAnswers());

    const answer = await tool.run({ fromSec: 3, checkpoint: 'pop' });

    expect(page.calls).toEqual([{ method: 'run_operation', params: { operation: 'set_timing', input: { fromSec: 3 }, checkpoint: 'pop' } }]);
    expect(answer.isError).toBe(true);
  });
});
