import { spawnSync } from 'node:child_process';
import type { CommandOutcome, CommandRunner } from '@mcp/domain/CommandRunner';

/** {@link CommandRunner} over Node's `spawnSync`. */
export class SpawnCommandRunner implements CommandRunner {
  constructor(private readonly platform: NodeJS.Platform) {}

  isOnPath(command: string): boolean {
    const finder = this.platform === 'win32' ? 'where' : 'which';
    return this.capture(finder, [command]).succeeded;
  }

  capture(command: string, args: ReadonlyArray<string>, cwd?: string): CommandOutcome {
    const result = spawnSync(command, [...args], { cwd, encoding: 'utf8', shell: this.needsShell() });
    return { succeeded: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
  }

  show(command: string, args: ReadonlyArray<string>, cwd?: string): boolean {
    return spawnSync(command, [...args], { cwd, stdio: 'inherit', shell: this.needsShell() }).status === 0;
  }

  /** A `.cmd` shim, as npm installs command lines on Windows, runs only through the shell there. */
  private needsShell(): boolean {
    return this.platform === 'win32';
  }
}
