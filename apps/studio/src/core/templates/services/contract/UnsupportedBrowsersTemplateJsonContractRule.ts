import {
  DECLARABLE_BROWSERS,
  DECLARABLE_BROWSER_NAMES,
} from '@core/browser-support/domain/DeclarableBrowser';
import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

/**
 * Checks that `unsupportedBrowsers` names browsers the app detects.
 * The failure it exists for is silent: the loader drops a slug it does
 * not recognise, so a template its author believes is opted out of a
 * browser keeps being offered there and renders wrong.
 *
 * It also guards the older mistake the field was renamed away from.
 * Every Chromium user agent ends in a `Safari/<version>` token, so
 * this used to be matched as a substring of `navigator.userAgent` and
 * a declared `"Safari"` disabled the template in Chrome, Edge, Brave,
 * Arc and Opera. Names are matched exactly now, and a user-agent
 * fragment reaches this rule instead of the render.
 */
export class UnsupportedBrowsersTemplateJsonContractRule implements TemplateJsonContractRule {

  check(templateJson: unknown): ContractViolation[] {
    const declared = this.declaredOf(templateJson);
    if (declared === undefined) return [];
    if (!Array.isArray(declared)) {
      return [{ message: '"unsupportedBrowsers" must be an array of browser names.' }];
    }
    return declared
      .filter((name) => typeof name !== 'string' || !Object.hasOwn(DECLARABLE_BROWSERS, name))
      .map((name) => ({
        message: `"unsupportedBrowsers" names the unknown browser ${JSON.stringify(name)}; `
          + 'the loader drops it and the template stays offered there. Name one of: '
          + DECLARABLE_BROWSER_NAMES.join(', ') + '.',
      }));
  }

  private declaredOf(templateJson: unknown): unknown {
    if (templateJson === null || typeof templateJson !== 'object') return undefined;
    return (templateJson as Record<string, unknown>)['unsupportedBrowsers'];
  }
}
