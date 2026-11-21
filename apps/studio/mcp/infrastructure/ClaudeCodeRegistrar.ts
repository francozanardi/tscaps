import path from 'node:path';
import type { AgentRegistrar, AgentRegistration } from '@mcp/domain/AgentRegistrar';
import type { McpServerLaunch } from '@mcp/domain/McpServerLaunch';
import type { CommandRunner } from '@mcp/domain/CommandRunner';

/** Registers the server with Claude Code through `claude mcp add`, in the user's scope, so every project sees it. */
export class ClaudeCodeRegistrar implements AgentRegistrar {
  readonly agentName = 'Claude Code';

  constructor(
    private readonly commands: CommandRunner,
    private readonly homeFolder: string,
  ) {}

  isInstalled(): boolean {
    return this.commands.isOnPath('claude');
  }

  register(launch: McpServerLaunch): AgentRegistration {
    // `add` refuses a name that is taken; a server registered by an earlier setup, at another path, is replaced.
    this.commands.capture('claude', ['mcp', 'remove', '--scope', 'user', 'tscaps']);
    const added = this.commands.capture('claude', ['mcp', 'add', '--scope', 'user', 'tscaps', '--', launch.command, ...launch.args]);
    if (added.succeeded) return { registered: true, detail: 'Added the tscaps MCP server for every project.' };
    return {
      registered: false,
      detail: `\`claude mcp add\` failed (${added.output}). Run it yourself: claude mcp add --scope user tscaps -- ${[launch.command, ...launch.args].join(' ')}`,
    };
  }

  skillsFolder(): string | null {
    return path.join(this.homeFolder, '.claude', 'skills');
  }
}
