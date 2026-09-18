import { describe, expect, it } from 'vitest';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { TypographyConfigSerializer } from '@core/sheets/services/TypographyConfigSerializer';

const serializer = new TypographyConfigSerializer();
const library = new FontStackLibrary();

/**
 * A sheet's stack survives being written down and read back. What is
 * stored is the faces themselves, not the id of the catalog stack they
 * came from: a reader tunes them one at a time, and a tuned stack
 * answers to no id.
 */

describe('a stack through storage', () => {
  it('comes back with every face it went in with', () => {
    const tuned = library.stackFor('anton').with('cyrillic', 'Roboto');
    const config = { ...TYPOGRAPHY_DEFAULTS, fontStack: tuned };
    const restored = serializer.deserialize(serializer.serialize(config));
    expect(restored.fontStack.toSnapshot()).toEqual(tuned.toSnapshot());
  });

  it('carries the faces as plain data, not as the object holding them', () => {
    const written = serializer.serialize({ ...TYPOGRAPHY_DEFAULTS, fontStack: library.stackFor('anton') });
    expect(written.fontStack).toEqual(library.stackFor('anton').toSnapshot());
  });

  it('leaves the rest of the typography untouched', () => {
    const config = { ...TYPOGRAPHY_DEFAULTS, fontSize: 7.5, italic: true };
    const restored = serializer.deserialize(serializer.serialize(config));
    expect(restored.fontSize).toBe(7.5);
    expect(restored.italic).toBe(true);
  });
});

/**
 * Storage cannot promise a shape. A payload that lost a face, or never
 * carried one, still has to produce a stack that renders — the defaults
 * fill whatever is missing, face by face.
 */
describe('a payload that does not hold a whole stack', () => {
  it('fills a missing face from the defaults', () => {
    const partial = { greek: 'Roboto' } as never;
    const restored = serializer.deserialize({ fontStack: partial });
    expect(restored.fontStack.familyFor('greek')).toBe('Roboto');
    expect(restored.fontStack.familyFor('latin')).toBe(TYPOGRAPHY_DEFAULTS.fontStack.familyFor('latin'));
  });

  it('falls back to the default stack when there is nothing to read', () => {
    for (const stored of [undefined, {}, { fontStack: 'Anton' as never }]) {
      const restored = serializer.deserialize(stored);
      expect(restored.fontStack.toSnapshot()).toEqual(TYPOGRAPHY_DEFAULTS.fontStack.toSnapshot());
    }
  });
});
