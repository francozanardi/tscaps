import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ClaudeCodeRegistrar } from '@mcp/infrastructure/ClaudeCodeRegistrar';
import { CodexRegistrar } from '@mcp/infrastructure/CodexRegistrar';
import { CopyingSkillInstaller } from '@mcp/infrastructure/CopyingSkillInstaller';
import { SpawnCommandRunner } from '@mcp/infrastructure/SpawnCommandRunner';
import { AgentSetup } from '@mcp/services/AgentSetup';

// One command between a fresh checkout (after `pnpm install`) and an agent that edits videos with tscaps: builds the
// editor and its operation list, then registers the MCP server with the agents installed here and installs the
// skill. Safe to run again, after a pull for instance: it replaces what an earlier run set up.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const studio = path.resolve(HERE, '..');

const { values: options } = parseArgs({ options: { 'skip-build': { type: 'boolean', default: false } } });

const commands = new SpawnCommandRunner(process.platform);
const setup = new AgentSetup(
  commands,
  [new ClaudeCodeRegistrar(commands, os.homedir()), new CodexRegistrar(commands, os.homedir())],
  new CopyingSkillInstaller(),
  { studio, skill: path.resolve(studio, '../../skills/tscaps-editor') },
  (line) => process.stdout.write(`${line}\n`),
);
const launch = {
  command: path.join(studio, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
  args: ['--tsconfig', path.join(studio, 'tsconfig.mcp.json'), path.join(studio, 'mcp', 'main.ts')],
};

if (setup.run(launch, !options['skip-build'])) {
  process.stdout.write('\nDone. Restart your agent, open it in the folder that holds your videos, and ask it to edit one.\n');
} else {
  process.exitCode = 1;
}
