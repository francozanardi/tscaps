import type { Browser } from '@playwright/test';
import type { BrowserLauncher } from '@mcp/domain/BrowserLauncher';

/**
 * Opens the page in Playwright's Chromium: headless where there is no
 * screen (a container, CI), or in a window of its own. The browser is
 * the session's, and closed with it. Playwright drives nothing but the
 * page's opening; every call goes over the page's own channel.
 */
export class PlaywrightBrowserLauncher implements BrowserLauncher {
  readonly description: string;
  private browser: Browser | null = null;

  constructor(
    private readonly headless: boolean,
    private readonly executablePath: string | null,
  ) {
    this.description = headless ? 'a headless browser nobody can see' : 'a browser window of its own';
  }

  /** Opens `url` in a new browser, closing the one opened before: a page that stopped answering is not left running. */
  async open(url: string): Promise<void> {
    await this.close();
    const { chromium } = await import('@playwright/test');
    this.browser = await chromium.launch({
      headless: this.headless,
      ...(this.executablePath === null ? {} : { executablePath: this.executablePath }),
    });
    const context = await this.browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => process.stderr.write(`[tscaps-mcp] page error: ${error.message}\n`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}
