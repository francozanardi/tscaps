import type { DeclarableBrowser } from '@core/browser-support/domain/DeclarableBrowser';
import type { TemplateCategory } from '@core/templates/domain/TemplateCategory';

export interface TemplateMetadata {
  id: string;
  name: string;
  /** The one family this template is listed under. */
  category: TemplateCategory;
  /**
   * Browsers whose engine renders this template incorrectly. A
   * template naming the browser in use is unrenderable in this
   * environment.
   */
  unsupportedBrowsers: readonly DeclarableBrowser[];
}
