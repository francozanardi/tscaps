import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { CheckBrowserSupportAction } from '@core/browser-support/actions/CheckBrowserSupportAction';
import { MediaBunnyCodecSupportChecker } from '@core/browser-support/infrastructure/MediaBunnyCodecSupportChecker';
import { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { SupportReport } from '@core/browser-support/domain/SupportReport';
import { FilteredTemplateRepository } from '@core/templates/infrastructure/repositories/FilteredTemplateRepository';

export interface BrowserSupportDependencies {
  readonly templateRepository: TemplateRepository;
  readonly userAgent: string;
}

export interface BrowserSupportModule {
  readonly supportReport: SupportReport;
  readonly filteredTemplateRepository: TemplateRepository;
  readonly templateSupportChecker: TemplateBrowserSupportChecker;
}

/**
 * Probes the browser for WebCodecs MP4 support and asks each built-in
 * template whether it can render here. Returns the full report, a
 * template repository view filtered to the supported subset, and the
 * per-template support checker so runtime consumers (e.g. project
 * load) can verify templates that arrived after boot.
 */
export async function bootBrowserSupport(
  deps: BrowserSupportDependencies,
): Promise<BrowserSupportModule> {
  const templateSupportChecker = new TemplateBrowserSupportChecker(deps.userAgent);
  const check = new CheckBrowserSupportAction(
    new MediaBunnyCodecSupportChecker(),
    templateSupportChecker,
  );
  const allTemplates = await deps.templateRepository.getAll();
  const supportReport = await check.execute(allTemplates);
  const filteredTemplateRepository = new FilteredTemplateRepository(
    deps.templateRepository,
    supportReport.supportedTemplateIds,
  );
  return { supportReport, filteredTemplateRepository, templateSupportChecker };
}
