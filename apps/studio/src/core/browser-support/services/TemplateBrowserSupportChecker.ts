import type { BrowserName, UserAgentInspector } from '@shared/browser';
import type { Template } from '@core/templates/domain/Template';

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
 */
export class TemplateBrowserSupportChecker {
  private readonly browser: BrowserName;

  constructor(userAgentInspector: UserAgentInspector) {
    this.browser = userAgentInspector.getBrowser();
  }

  isSupported(template: Template): boolean {
    const declared: readonly string[] = template.metadata.unsupportedBrowsers;
    return !declared.includes(this.browser);
  }
}
