import { describe, expect, it } from 'vitest';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';

const library = new FontStackLibrary();
const resolver = new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver());

describe('resolving the Other face', () => {
  it('uses only the literal device family when no managed script is present', () => {
    const stack = library.stackFor('inter').with('other', 'serif');
    const scripts = new CaptionScripts(null, new Set(), false, new Set([0x65E5]));
    expect(resolver.resolve(stack, scripts)).toBe('serif');
  });

  it('keeps the compiled managed family before the literal device family in mixed text', () => {
    const stack = library.stackFor('inter').with('other', 'monospace');
    const scripts = new CaptionScripts('latin', new Set(['latin']), false, new Set([0x4E16]));
    const resolved = resolver.resolve(stack, scripts);
    expect(resolved).toMatch(/^'tscaps-latin-inter-variable-/);
    expect(resolved.endsWith(', monospace')).toBe(true);
  });

  it('quotes an uploaded Other family but not a CSS generic family', () => {
    const scripts = new CaptionScripts(null, new Set(), false, new Set([0x65E5]));
    expect(resolver.resolve(library.stackFor('inter').with('other', 'My CJK Font'), scripts))
      .toBe("'My CJK Font'");
  });

  it('keeps known-only stacks free of fallback families', () => {
    const scripts = new CaptionScripts('latin', new Set(['latin']));
    expect(resolver.resolve(library.stackFor('inter'), scripts)).not.toContain('sans-serif');
  });
});
