import { describe, expect, it } from 'vitest';
import { DescriptionTemplateJsonContractRule } from '@core/templates/services/contract/DescriptionTemplateJsonContractRule';

describe('DescriptionTemplateJsonContractRule', () => {
  const rule = new DescriptionTemplateJsonContractRule();

  it('accepts a template that describes its look', () => {
    expect(rule.check({ name: 'X', description: 'Bold uppercase with a yellow active word.' })).toEqual([]);
  });

  it('refuses a template that declares no description', () => {
    expect(rule.check({ name: 'X' })).toHaveLength(1);
  });

  it('refuses a blank description', () => {
    expect(rule.check({ name: 'X', description: '   ' })).toHaveLength(1);
  });

  it('refuses a description that is not a string', () => {
    expect(rule.check({ name: 'X', description: ['Bold'] })).toHaveLength(1);
  });
});
