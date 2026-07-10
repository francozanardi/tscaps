import type { CodecSupportChecker } from '@core/browser-support/domain/CodecSupportChecker';
import { SupportReport } from '@core/browser-support/domain/SupportReport';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';

/**
 * Produces a `SupportReport` for the current environment by combining
 * an MP4 encoding check with each template's declarative
 * `unsupportedUserAgents` patterns. The per-template verdict is
 * delegated to `TemplateBrowserSupportChecker` so the same rule is
 * shared with runtime lookups against templates that arrived after
 * boot (e.g. user-saved templates).
 */
export class CheckBrowserSupportAction {

  constructor(
    private readonly codecChecker: CodecSupportChecker,
    private readonly templateChecker: TemplateBrowserSupportChecker,
  ) {}

  async execute(templates: ReadonlyArray<Template>): Promise<SupportReport> {
    const webcodecsSupported = await this.codecChecker.canEncodeMp4();
    const allIds = new Set<string>();
    const supportedIds = new Set<string>();
    for (const template of templates) {
      allIds.add(template.metadata.id);
      if (this.templateChecker.isSupported(template)) {
        supportedIds.add(template.metadata.id);
      }
    }
    return new SupportReport(webcodecsSupported, supportedIds, allIds);
  }
}
