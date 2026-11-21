import type { AgentRegistrar } from '@mcp/domain/AgentRegistrar';
import type { CommandRunner } from '@mcp/domain/CommandRunner';
import type { McpServerLaunch } from '@mcp/domain/McpServerLaunch';
import type { SkillInstaller } from '@mcp/domain/SkillInstaller';

/** Where the setup works: the editor's package folder and the skill it installs. */
export interface AgentSetupFolders {
  /** `apps/studio`, where the editor is built and the server's code lives. */
  readonly studio: string;
  /** The `tscaps-editor` skill folder. */
  readonly skill: string;
}

/**
 * Makes this checkout ready for a coding agent in one run: builds the editor, downloads the browser the operation
 * list is read in, writes that list, registers the MCP server with every agent installed here, and gives the skill
 * to the agents that load skills. Each line it reports is written for the person who ran it.
 */
export class AgentSetup {
  constructor(
    private readonly commands: CommandRunner,
    private readonly registrars: ReadonlyArray<AgentRegistrar>,
    private readonly skillInstaller: SkillInstaller,
    private readonly folders: AgentSetupFolders,
    private readonly report: (line: string) => void,
  ) {}

  /** Runs every step; false when a step the server cannot work without failed. `build: false` keeps the current build. */
  run(launch: McpServerLaunch, build: boolean): boolean {
    if (build && !this.step('Building the editor', 'pnpm', ['build'])) return false;
    if (!this.step('Downloading the browser the editor is checked in', 'pnpm', ['exec', 'playwright', 'install', 'chromium'])) return false;
    if (!this.step('Listing the editor\'s operations', 'pnpm', ['mcp:operations'])) return false;
    this.registerWithAgents(launch);
    return true;
  }

  private step(title: string, command: string, args: ReadonlyArray<string>): boolean {
    this.report(`\n▸ ${title}…`);
    const succeeded = this.commands.show(command, args, this.folders.studio);
    if (!succeeded) this.report(`✗ ${title} failed. The output above says why.`);
    return succeeded;
  }

  private registerWithAgents(launch: McpServerLaunch): void {
    const installed = this.registrars.filter((registrar) => registrar.isInstalled());
    if (installed.length === 0) {
      this.report('\nNo Claude Code or Codex was found on this machine. Give your agent this command to start the server:');
      this.report(`  ${[launch.command, ...launch.args].join(' ')}`);
      this.report(`And copy ${this.folders.skill} into the folder it loads skills from.`);
      return;
    }
    for (const registrar of installed) this.registerWith(registrar, launch);
  }

  private registerWith(registrar: AgentRegistrar, launch: McpServerLaunch): void {
    const registration = registrar.register(launch);
    this.report(`\n${registration.registered ? '✓' : '✗'} ${registrar.agentName}: ${registration.detail}`);
    const skillsFolder = registrar.skillsFolder();
    if (skillsFolder === null) {
      this.report(`  For the editing guides too, copy ${this.folders.skill} into the folder ${registrar.agentName} loads skills from.`);
      return;
    }
    this.report(`  Installed the tscaps-editor skill in ${this.skillInstaller.install(this.folders.skill, skillsFolder)}.`);
  }
}
