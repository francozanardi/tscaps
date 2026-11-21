import type { BrowserLauncher } from '@mcp/domain/BrowserLauncher';
import type { ChromiumExecutableFinder } from '@mcp/infrastructure/ChromiumExecutableFinder';
import { PlaywrightBrowserLauncher } from '@mcp/infrastructure/PlaywrightBrowserLauncher';
import { SystemBrowserLauncher } from '@mcp/infrastructure/SystemBrowserLauncher';

/** How the person asked for the page to be opened. */
export interface BrowserChoice {
  /** Never show the page: a headless browser, for a machine with no screen or a run nobody watches. */
  readonly headless: boolean;
  /** A browser executable to use instead of the one found. */
  readonly executable: string | null;
  /** Arguments added to the browser's command line. */
  readonly extraArgs: ReadonlyArray<string>;
}

/**
 * Picks how the page opens: in a new window of a Chromium-family browser
 * installed here, where there is a screen to show it on; headless
 * otherwise, or when asked, in that installed browser where there is one
 * and in Playwright's own Chromium where there is none.
 */
export class BrowserLauncherChooser {
  constructor(
    private readonly finder: ChromiumExecutableFinder,
    private readonly platform: NodeJS.Platform,
    private readonly environment: NodeJS.ProcessEnv,
  ) {}

  choose(choice: BrowserChoice): BrowserLauncher {
    const executable = choice.executable ?? this.finder.find();
    // Headless runs through Playwright either way; driving the installed browser spares downloading its own Chromium.
    if (choice.headless || !this.hasScreen()) return new PlaywrightBrowserLauncher(true, executable);
    if (executable === null) return new PlaywrightBrowserLauncher(false, null);
    return new SystemBrowserLauncher(executable, choice.extraArgs);
  }

  private hasScreen(): boolean {
    if (this.platform !== 'linux') return true;
    return Boolean(this.environment['DISPLAY'] || this.environment['WAYLAND_DISPLAY']);
  }
}
