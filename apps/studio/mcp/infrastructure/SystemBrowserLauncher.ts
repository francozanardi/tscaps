import { spawn } from 'node:child_process';
import type { BrowserLauncher } from '@mcp/domain/BrowserLauncher';

/**
 * Opens the page in a browser installed on this machine, the way the
 * operating system opens a link: a new window of the person's own
 * browser, with their profile, GPU and codecs. Nothing drives that
 * window but the page's own channel, and it is left open when the
 * session ends: it is the person's.
 */
export class SystemBrowserLauncher implements BrowserLauncher {
  readonly description: string;

  constructor(
    private readonly executable: string,
    private readonly extraArgs: ReadonlyArray<string>,
  ) {
    this.description = `a new window of ${executable}`;
  }

  async open(url: string): Promise<void> {
    const child = spawn(this.executable, [...this.extraArgs, '--new-window', url], { stdio: 'ignore', detached: true });
    child.unref();
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  }

  async close(): Promise<void> {
    // The window belongs to the person's browser, which may hold their own tabs.
  }
}
