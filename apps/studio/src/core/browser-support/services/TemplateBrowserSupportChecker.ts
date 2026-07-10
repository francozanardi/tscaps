import type { Template } from '@core/templates/domain/Template';

/**
 * Decides whether a template can render correctly in the current
 * browser by matching the configured user agent against the template's
 * declarative `metadata.unsupportedUserAgents` patterns. Pure: same
 * template + same user agent always yields the same verdict. Works
 * uniformly for built-in and user-saved templates — no precomputed
 * universe to consult.
 */
export class TemplateBrowserSupportChecker {
  private readonly lowercasedUserAgent: string;

  constructor(userAgent: string) {
    this.lowercasedUserAgent = userAgent.toLowerCase();
  }

  isSupported(template: Template): boolean {
    return !template.metadata.unsupportedUserAgents.some(
      (pattern) => this.lowercasedUserAgent.includes(pattern.toLowerCase()),
    );
  }
}
