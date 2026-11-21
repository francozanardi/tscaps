import type { ListedOperation } from '@mcp/domain/ListedOperation';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';

const CHECKPOINT_PROPERTY = {
  type: 'string',
  description: 'A key of your own: edits run under the same key join one checkpoint of the editor\'s history, which the person undoes at once. Each call makes its own checkpoint when left out.',
};

/**
 * One operation of the editor's catalog offered as a tool of its own,
 * under the operation's name, description and input schema. An edit also
 * takes `checkpoint`. The input is checked by the operation in the page,
 * which answers what does not fit as problems.
 */
export class OperationTool implements McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;

  constructor(
    private readonly operation: ListedOperation,
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
  ) {
    this.name = operation.name;
    this.description = operation.description;
    this.inputSchema = operation.effect === 'edit' ? this.withCheckpoint(operation.inputSchema) : operation.inputSchema;
  }

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const { checkpoint, ...input } = args;
    const params = {
      operation: this.operation.name,
      input,
      ...(typeof checkpoint === 'string' && this.operation.effect === 'edit' ? { checkpoint } : {}),
    };
    const result = (await this.pageCalls.call('run_operation', params)) as { ok?: boolean };
    return { ...this.answers.json(result), isError: result.ok === false };
  }

  private withCheckpoint(schema: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const properties = (schema['properties'] ?? {}) as Readonly<Record<string, unknown>>;
    return { ...schema, properties: { ...properties, checkpoint: CHECKPOINT_PROPERTY } };
  }
}
