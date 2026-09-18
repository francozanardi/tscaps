import { describe, expect, it } from 'vitest';
import { UnsupportedBrowsersTemplateJsonContractRule } from '@core/templates/services/contract/UnsupportedBrowsersTemplateJsonContractRule';

describe('UnsupportedBrowsersTemplateJsonContractRule', () => {
  const rule = new UnsupportedBrowsersTemplateJsonContractRule();

  it('accepts a template that declares nothing', () => {
    expect(rule.check({ name: 'X' })).toEqual([]);
  });

  it('accepts every browser the app detects', () => {
    for (const browser of ['chrome', 'edge', 'firefox', 'safari', 'opera']) {
      expect(rule.check({ name: 'X', unsupportedBrowsers: [browser] })).toEqual([]);
    }
  });

  it('refuses a user-agent fragment and names the browsers that exist', () => {
    const [violation] = rule.check({ name: 'X', unsupportedBrowsers: ['Safari/605.1.15'] });
    expect(violation?.message).toContain('safari');
  });

  it('refuses a browser named by its engine', () => {
    expect(rule.check({ name: 'X', unsupportedBrowsers: ['webkit'] })).toHaveLength(1);
  });

  it('refuses the inspector\'s no-verdict answer, which restricts nothing', () => {
    expect(rule.check({ name: 'X', unsupportedBrowsers: ['unknown'] })).toHaveLength(1);
  });

  it('reports every unknown name, not just the first', () => {
    expect(rule.check({ name: 'X', unsupportedBrowsers: ['Firefox', 'chrome', 'brave'] })).toHaveLength(2);
  });

  it('refuses a declaration that is not an array of strings', () => {
    expect(rule.check({ name: 'X', unsupportedBrowsers: 'firefox' })).toHaveLength(1);
    expect(rule.check({ name: 'X', unsupportedBrowsers: [7] })).toHaveLength(1);
  });
});
