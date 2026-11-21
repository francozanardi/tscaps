/** A picture format a tool answers in. */
export type McpPictureType = 'image/png' | 'image/jpeg' | 'image/webp';

/** One piece of what a tool answers: text, or a picture as base64. */
export type McpToolContent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly data: string; readonly mimeType: McpPictureType };

/** What a tool answers. `isError` marks an answer the agent should read as a failure. */
export interface McpToolAnswer {
  readonly content: ReadonlyArray<McpToolContent>;
  readonly isError?: boolean;
}

/**
 * One tool the server offers: its name, the description the agent
 * chooses by, and a JSON Schema of its arguments. `run` validates its
 * arguments itself. A rejection is answered to the agent as an error
 * carrying the error's message, so a message is written for the agent
 * to act on.
 */
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer>;
}
