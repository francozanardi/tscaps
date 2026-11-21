import path from 'node:path';
import type { AgentRegistrar, AgentRegistration } from '@mcp/domain/AgentRegistrar';
import type { McpServerLaunch } from '@mcp/domain/McpServerLaunch';
import type { CommandRunner } from '@mcp/domain/CommandRunner';

/** Registers the server with Codex through `codex mcp add`, which writes it to the user's `~/.codex/config.toml`. */
export class CodexRegistrar implements AgentRegistrar {
  readonly agentName = 'Codex';

  constructor(
    private readonly commands: CommandRunner,
    private readonly homeFolder: string,
  ) {}

  isInstalled(): boolean {
    return this.commands.isOnPath('codex');
  }

  register(launch: McpServerLaunch): AgentRegistration {
    // A server registered by an earlier setup, at another path, is replaced.
    this.commands.capture('codex', ['mcp', 'remove', 'tscaps']);
    const added = this.commands.capture('codex', ['mcp', 'add', 'tscaps', '--', launch.command, ...launch.args]);
    if (added.succeeded) return { registered: true, detail: 'Added the tscaps MCP server.' };
    return { registered: false, detail: `\`codex mcp add\` failed (${added.output}). Add this to ~/.codex/config.toml:\n${this.configToml(launch)}` };
  }

  /** The user's folder of the Agent Skills standard, which Codex reads. */
  skillsFolder(): string | null {
    return path.join(this.homeFolder, '.agents', 'skills');
  }

  private configToml(launch: McpServerLaunch): string {
    return [
      '[mcp_servers.tscaps]',
      `command = ${JSON.stringify(launch.command)}`,
      `args = [${launch.args.map((arg) => JSON.stringify(arg)).join(', ')}]`,
    ].join('\n');
  }
}
