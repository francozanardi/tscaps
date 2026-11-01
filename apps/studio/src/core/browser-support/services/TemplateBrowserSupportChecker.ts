import type { UserAgentInspector } from '@shared/browser';
import type { Template } from '@core/templates/domain/Template';
import type { DeclarableBrowser } from '@core/browser-support/domain/DeclarableBrowser';
import type { WebKitReleaseDetector } from '@core/browser-support/domain/WebKitReleaseDetector';

/**
 * Decides whether a template can render correctly in the current
 * browser by matching the detected browser against the template's
 * declarative `metadata.unsupportedBrowsers` list. Pure: same
 * template + same browser always yields the same verdict. Works
 * uniformly for built-in and user-saved templates — no precomputed
 * universe to consult.
 *
 * The verdict is keyed on the browser the inspector resolves, never
 * on raw user-agent text. Every Chromium user agent ends in a
 * `Safari/<version>` token, so a substring test for a browser name
 * answers yes for browsers that were never named.
 *
 * `safari-before-26` applies on top of `safari` when the detector finds
 * the host's WebKit older than release 26, which the user agent cannot
 * tell on iOS. Both are settled when the checker is built.
 */
export class TemplateBrowserSupportChecker {
  private readonly hostSlugs: ReadonlySet<string>;

  constructor(userAgentInspector: UserAgentInspector, webKitReleaseDetector: WebKitReleaseDetector) {
    this.hostSlugs = this.slugsFor(userAgentInspector, webKitReleaseDetector);
  }

  isSupported(template: Template): boolean {
    const declared: readonly string[] = template.metadata.unsupportedBrowsers;
    return !declared.some((slug) => this.hostSlugs.has(slug));
  }

  private slugsFor(userAgentInspector: UserAgentInspector, webKitReleaseDetector: WebKitReleaseDetector): ReadonlySet<string> {
    const browser = userAgentInspector.getBrowser();
    if (browser === 'safari' && webKitReleaseDetector.isBefore26()) {
      return new Set([browser, 'safari-before-26' satisfies DeclarableBrowser]);
    }
    return new Set([browser]);
  }
}
