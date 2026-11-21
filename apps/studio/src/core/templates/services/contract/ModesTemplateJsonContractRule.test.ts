import { describe, expect, it } from 'vitest';
import { TagConditionParser } from '@tscaps/engine';
import { ModesTemplateJsonContractRule } from '@core/templates/services/contract/ModesTemplateJsonContractRule';
import { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';

describe('ModesTemplateJsonContractRule', () => {
  const rule = new ModesTemplateJsonContractRule(new ModeMatcherRegistry(new TagConditionParser()));
  const spotlight = { label: 'Key phrases', matchers: [{ type: 'tag-condition', condition: 'hook or peak' }] };

  it('accepts a template with no modes', () => {
    expect(rule.check({ name: 'X' })).toEqual([]);
  });

  it('accepts a labelled body and a labelled mode a matcher can fill', () => {
    expect(rule.check({ name: 'X', modes: { base: { label: 'Captions' }, spotlight } })).toEqual([]);
  });

  it('refuses a key that is not a template tag, naming the ones that are', () => {
    const [violation] = rule.check({ name: 'X', modes: { poster: spotlight } });

    expect(violation?.message).toContain('spotlight');
  });

  it('refuses a mode without a label or without a matcher', () => {
    expect(rule.check({ name: 'X', modes: { spotlight: { matchers: [] } } })).toHaveLength(2);
  });

  it('refuses a matcher of no known kind, or one whose expression does not parse', () => {
    expect(rule.check({ name: 'X', modes: { spotlight: { label: 'K', matchers: [{ type: 'by-length' }, { type: 'tag-condition', condition: 'peak or' }] } } }))
      .toHaveLength(2);
  });
});
