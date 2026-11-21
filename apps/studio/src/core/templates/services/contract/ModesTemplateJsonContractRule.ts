import { TEMPLATE_TAG_NAMES } from '@core/tagging/domain/TagName';
import type { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';
import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

/**
 * Checks a template's modes. The loader skips a key it does not know and
 * names a mode after its tag when it has no label, so a misspelled tag
 * would ship a template without its mode and an unlabelled one a tab
 * named after an internal tag; both are refused here, as is a mode no
 * matcher can put a word in.
 */
export class ModesTemplateJsonContractRule implements TemplateJsonContractRule {

  constructor(private readonly matchers: ModeMatcherRegistry) {}

  check(templateJson: unknown): ContractViolation[] {
    const declared = this.modesOf(templateJson);
    if (declared === undefined) return [];
    if (!this.isRecord(declared)) return [{ message: '"modes" must be an object keyed by "base" and template tags.' }];
    return Object.entries(declared).flatMap(([key, mode]) => this.violationsOf(key, mode));
  }

  private violationsOf(key: string, mode: unknown): ContractViolation[] {
    if (key === 'base') return this.labelViolations(key, mode);
    if (!(TEMPLATE_TAG_NAMES as readonly string[]).includes(key)) {
      return [{ message: `modes."${key}" is neither "base" nor a template tag. Name one of: base, ${TEMPLATE_TAG_NAMES.join(', ')}.` }];
    }
    return [...this.labelViolations(key, mode), ...this.matcherViolations(key, mode)];
  }

  private labelViolations(key: string, mode: unknown): ContractViolation[] {
    if (this.isRecord(mode) && typeof mode['label'] === 'string' && mode['label'].trim() !== '') return [];
    return [{ message: `modes."${key}" needs a "label", the name its tab shows in the Layout tab.` }];
  }

  private matcherViolations(key: string, mode: unknown): ContractViolation[] {
    const matchers = this.isRecord(mode) ? mode['matchers'] : undefined;
    if (!Array.isArray(matchers) || matchers.length === 0) {
      return [{ message: `modes."${key}" needs at least one matcher, or no word ever goes into it.` }];
    }
    return matchers.flatMap((matcher, index) => {
      try {
        this.matchers.build(matcher as { type: string });
        return [];
      } catch (error) {
        return [{ message: `modes."${key}".matchers[${index}]: ${error instanceof Error ? error.message : String(error)}` }];
      }
    });
  }

  private modesOf(templateJson: unknown): unknown {
    return this.isRecord(templateJson) ? templateJson['modes'] : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
