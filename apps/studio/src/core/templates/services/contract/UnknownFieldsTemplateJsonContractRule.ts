import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

// Mirrors the keys of JsonTemplateSchema; update both together.
const KNOWN_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'category',
  'unsupportedBrowsers',
  'styleControls',
  'typography',
  'rotation',
  'segmentSplitters',
  'lineSplitter',
  'alignment',
  'rendering',
  'features',
  'behindActor',
  'effects',
  'variants',
]);

/**
 * Flags top-level fields the loader does not know — it ignores them
 * silently, so a typo'd field name is dead weight its author believes
 * is doing something. Also requires the one mandatory field, `name`.
 */
export class UnknownFieldsTemplateJsonContractRule implements TemplateJsonContractRule {

  check(templateJson: unknown): ContractViolation[] {
    if (templateJson === null || typeof templateJson !== 'object' || Array.isArray(templateJson)) {
      return [{ message: 'template.json must be a JSON object.' }];
    }
    const record = templateJson as Record<string, unknown>;
    const violations: ContractViolation[] = [];
    if (typeof record['name'] !== 'string' || record['name'].trim() === '') {
      violations.push({ message: 'template.json must declare a non-empty "name".' });
    }
    for (const key of Object.keys(record)) {
      if (KNOWN_TOP_LEVEL_FIELDS.has(key)) continue;
      violations.push({
        message: `template.json field "${key}" is not part of the schema; the loader silently ignores it.`,
      });
    }
    return violations;
  }
}
