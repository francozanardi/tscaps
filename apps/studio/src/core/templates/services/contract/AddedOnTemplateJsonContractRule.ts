import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';

/**
 * Checks that `addedOn`, when present, is a real `YYYY-MM-DD` day. The
 * failure it exists for is silent: a malformed date loads as absent, so
 * a template meant to be marked as new ships unmarked and nothing else
 * says so.
 */
export class AddedOnTemplateJsonContractRule implements TemplateJsonContractRule {

  constructor(private readonly calendarDateParser: CalendarDateParser) {}

  check(templateJson: unknown): ContractViolation[] {
    if (templateJson === null || typeof templateJson !== 'object') return [];
    const record = templateJson as Record<string, unknown>;
    if (!('addedOn' in record)) return [];
    const declared = record['addedOn'];
    if (typeof declared === 'string' && this.calendarDateParser.parse(declared) !== null) return [];
    return [{
      message: `Declares "addedOn" as ${JSON.stringify(declared)}. Write a real day as "YYYY-MM-DD".`,
    }];
  }
}
