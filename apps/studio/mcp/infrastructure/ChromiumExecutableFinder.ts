import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Finds a Chromium-family browser installed on this machine (Chrome,
 * Edge, Chromium, Brave), in that order: the editor's export relies on
 * WebCodecs encoders that browsers outside that family lack or limit.
 */
export class ChromiumExecutableFinder {
  constructor(
    private readonly platform: NodeJS.Platform,
    private readonly environment: NodeJS.ProcessEnv,
  ) {}

  /** The executable's path, or null when none is installed where browsers usually are. */
  find(): string | null {
    for (const candidate of this.candidates()) {
      const found = path.isAbsolute(candidate) ? (existsSync(candidate) ? candidate : null) : this.onPath(candidate);
      if (found !== null) return found;
    }
    return null;
  }

  private candidates(): ReadonlyArray<string> {
    if (this.platform === 'darwin') {
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      ];
    }
    if (this.platform === 'win32') {
      const roots = [this.environment['PROGRAMFILES'], this.environment['PROGRAMFILES(X86)'], this.environment['LOCALAPPDATA']]
        .filter((root): root is string => typeof root === 'string');
      return roots.flatMap((root) => [
        path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      ]);
    }
    return ['google-chrome', 'google-chrome-stable', 'microsoft-edge', 'chromium', 'chromium-browser', 'brave-browser'];
  }

  private onPath(command: string): string | null {
    try {
      const found = execFileSync('which', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return found.length > 0 ? found : null;
    } catch {
      // `which` exits non-zero when the command is not installed.
      return null;
    }
  }
}
