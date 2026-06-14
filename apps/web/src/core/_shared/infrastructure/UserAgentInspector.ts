export type BrowserName = 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'unknown';
export type OperatingSystem = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';

export interface BrowserEnvironment {
  readonly browser: BrowserName;
  readonly os: OperatingSystem;
  readonly isMobile: boolean;
  readonly humanBrowser: string;
  readonly humanOs: string;
}

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Detects browser, operating system, and mobile-ness of the runtime the
 * app is loaded into. Detection is best-effort: every major desktop and
 * mobile browser of 2024+ resolves to a concrete value; niche or older
 * runtimes fall through to `'unknown'` (or `false` for `isMobile`), in
 * which case downstream copy should stay generic.
 *
 * The result is resolved once at construction and cached — user agents
 * do not change between calls and a stable answer lets memoizing
 * consumers avoid recomputation. Construct one instance at the
 * composition root and pass it as a dependency.
 *
 * `detect()` returns the full environment for callers that need every
 * field; the individual getters are there for callers that only want
 * one (e.g. an export-writer factory that only cares about `isMobile`).
 */
export class UserAgentInspector {

  private readonly environment: BrowserEnvironment;

  constructor() {
    const userAgent = this.readUserAgent();
    const browser = this.parseBrowser(userAgent);
    const os = this.parseOs(userAgent);
    this.environment = {
      browser,
      os,
      isMobile: this.parseIsMobile(userAgent),
      humanBrowser: this.humanizeBrowser(browser),
      humanOs: this.humanizeOs(os),
    };
  }

  detect(): BrowserEnvironment {
    return this.environment;
  }

  getBrowser(): BrowserName {
    return this.environment.browser;
  }

  getOs(): OperatingSystem {
    return this.environment.os;
  }

  isMobile(): boolean {
    return this.environment.isMobile;
  }

  getHumanBrowser(): string {
    return this.environment.humanBrowser;
  }

  getHumanOs(): string {
    return this.environment.humanOs;
  }

  private readUserAgent(): string {
    return (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '';
  }

  private parseBrowser(userAgent: string): BrowserName {
    // Edge identifies as "Edg/<version>"; check first so it doesn't slip
    // through the Chrome regex (Edge UAs also contain "Chrome/").
    if (/edg\//i.test(userAgent)) return 'edge';
    if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) return 'opera';
    if (/firefox/i.test(userAgent)) return 'firefox';
    if (/chrome/i.test(userAgent)) return 'chrome';
    if (/safari/i.test(userAgent)) return 'safari';
    return 'unknown';
  }

  private parseOs(userAgent: string): OperatingSystem {
    if (/android/i.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
    if (/windows/i.test(userAgent)) return 'windows';
    if (/mac os x|macintosh/i.test(userAgent)) return 'macos';
    if (/linux/i.test(userAgent)) return 'linux';
    return 'unknown';
  }

  private parseIsMobile(userAgent: string): boolean {
    if (typeof navigator === 'undefined') return false;
    const uaData = (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData;
    if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
    if (MOBILE_UA.test(userAgent)) return true;
    // iPad on iPadOS 13+: pretends to be macOS but exposes touch.
    const isMacUA = /Macintosh/.test(userAgent);
    const hasTouch = navigator.maxTouchPoints > 1;
    return isMacUA && hasTouch;
  }

  private humanizeBrowser(browser: BrowserName): string {
    switch (browser) {
      case 'chrome': return 'Chrome';
      case 'edge': return 'Edge';
      case 'firefox': return 'Firefox';
      case 'safari': return 'Safari';
      case 'opera': return 'Opera';
      default: return 'your current browser';
    }
  }

  private humanizeOs(os: OperatingSystem): string {
    switch (os) {
      case 'windows': return 'Windows';
      case 'macos': return 'macOS';
      case 'linux': return 'Linux';
      case 'ios': return 'iOS';
      case 'android': return 'Android';
      default: return 'your operating system';
    }
  }
}
