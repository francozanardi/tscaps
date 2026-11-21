import type { McpServerLaunch } from '@mcp/domain/McpServerLaunch';

/** What registering the server with one agent came to. */
export interface AgentRegistration {
  readonly registered: boolean;
  /** One line for the person: what was done, or what to do by hand when it could not be done. */
  readonly detail: string;
}

/** One coding agent that can be told, through its own command line, to start the tscaps MCP server. */
export interface AgentRegistrar {
  /** The agent's name, as the person knows it. */
  readonly agentName: string;
  /** Whether the agent's command line is installed on this machine. */
  isInstalled(): boolean;
  /**
   * Registers the server under the name `tscaps` for every folder the person opens the agent in, replacing an
   * earlier registration of that name.
   */
  register(launch: McpServerLaunch): AgentRegistration;
  /** The folder the agent loads skills from, or null when it loads none or this registrar does not know where. */
  skillsFolder(): string | null;
}
