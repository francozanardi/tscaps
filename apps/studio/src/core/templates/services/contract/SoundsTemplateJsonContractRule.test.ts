import { describe, expect, it } from 'vitest';
import { TagConditionParser } from '@tscaps/engine';
import { SoundsTemplateJsonContractRule } from '@core/templates/services/contract/SoundsTemplateJsonContractRule';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';

describe('SoundsTemplateJsonContractRule', () => {
  const rule = new SoundsTemplateJsonContractRule(new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/'), new TagConditionParser());

  it('accepts a template that plays no sound', () => {
    expect(rule.check({ name: 'X' })).toEqual([]);
  });

  it('accepts a bundled sound on a tag expression, within range', () => {
    expect(rule.check({ name: 'X', sounds: [{ when: 'hook or peak', sound: 'click-mouse', volume: 0.3, offset: -0.05, alone: true }] })).toEqual([]);
  });

  it('refuses a sound the pack does not carry, naming the ones it does', () => {
    const [violation] = rule.check({ name: 'X', sounds: [{ when: 'peak', sound: 'click-tick' }] });

    expect(violation?.message).toContain('click-mouse');
  });

  it('refuses an expression that does not parse', () => {
    expect(rule.check({ name: 'X', sounds: [{ when: 'peak or', sound: 'click' }] })).toHaveLength(1);
  });

  it('refuses a volume or an offset out of range', () => {
    expect(rule.check({ name: 'X', sounds: [{ when: 'peak', sound: 'click', volume: 2, offset: 30 }] })).toHaveLength(2);
  });
});
