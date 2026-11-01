import { describe, expect, it } from 'vitest';
import { TileTemplateJsonContractRule } from '@core/templates/services/contract/TileTemplateJsonContractRule';

describe('TileTemplateJsonContractRule', () => {
  const rule = new TileTemplateJsonContractRule();

  it('accepts a template that declares no tile', () => {
    expect(rule.check({ name: 'X' })).toEqual([]);
  });

  it('accepts the name in lines of words with tags, an emoji and one word said', () => {
    const tile = { lines: [[{ text: 'Big' }], [{ text: 'Name', tags: ['emphasis'], emoji: '🔥', said: true }]] };
    expect(rule.check({ name: 'Big Name', tile })).toEqual([]);
  });

  // Every card is its template's name; a tile dresses the name, it does not replace it.
  it('refuses a tile that does not say the template\'s name', () => {
    const [violation] = rule.check({ name: 'Miso', tile: { lines: [[{ text: 'This' }, { text: 'is' }], [{ text: 'Miso' }]] } });
    expect(violation?.message).toContain('"This is Miso"');
    expect(rule.check({ name: 'Miso', tile: { lines: [[{ text: 'MISO', emoji: '🔥' }]] } })).toEqual([]);
  });

  it('refuses a tile without lines, or with an empty line', () => {
    expect(rule.check({ name: 'a', tile: {} })).toHaveLength(1);
    expect(rule.check({ name: 'a', tile: { lines: [] } })).toHaveLength(1);
    expect(rule.check({ name: 'a', tile: { lines: [[{ text: 'a' }], []] } })).toHaveLength(1);
  });

  // The loader drops such a word, so the tile would show less than written.
  it('refuses a word without text', () => {
    expect(rule.check({ name: '', tile: { lines: [[{ text: ' ' }, { emoji: '🔥' }]] } })).toHaveLength(2);
  });

  it('refuses a tag no tagger emits, which nothing would paint', () => {
    const [violation] = rule.check({ name: 'a', tile: { lines: [[{ text: 'a', tags: ['emphasis', 'Emphasis'] }]] } });
    expect(violation?.message).toContain('"Emphasis"');
  });

  it('refuses two words said at once', () => {
    const tile = { lines: [[{ text: 'a', said: true }, { text: 'b', said: true }]] };
    expect(rule.check({ name: 'a b', tile })).toHaveLength(1);
  });

  it('refuses a field the loader does not read', () => {
    expect(rule.check({ name: 'a', tile: { lines: [[{ text: 'a', color: 'red' }]] } })).toHaveLength(1);
  });
});
