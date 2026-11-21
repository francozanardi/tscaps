import { describe, expect, it } from 'vitest';
import { CategoryTemplateJsonContractRule } from '@core/templates/services/contract/CategoryTemplateJsonContractRule';

describe('CategoryTemplateJsonContractRule', () => {
  const rule = new CategoryTemplateJsonContractRule();

  it('accepts every family the gallery ships', () => {
    for (const category of ['magazine', 'modern', 'viral', 'classic', 'lab']) {
      expect(rule.check({ name: 'X', category })).toEqual([]);
    }
  });

  it('refuses a template that names no family', () => {
    expect(rule.check({ name: 'X' })).toHaveLength(1);
  });

  it('refuses a misspelled family and names the ones that exist', () => {
    const [violation] = rule.check({ name: 'X', category: 'Magazine' });
    expect(violation?.message).toContain('magazine');
  });

  it('refuses a family that is not a string', () => {
    expect(rule.check({ name: 'X', category: ['viral'] })).toHaveLength(1);
  });
});
