/** How an agent starts the tscaps MCP server: the executable and its arguments, all paths absolute. */
export interface McpServerLaunch {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}
