import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { ProjectV15ToV16Migration } from '@core/projects/services/migrations/ProjectV15ToV16Migration';

/**
 * What happens to an entrance that was recorded and nowhere else.
 *
 * The CSS it produces used to be generated at assembly time and never
 * reached the text. A step that fails to write it is an element whose
 * animation disappears on load — silently, since the record still says
 * which entrance was picked.
 *
 * Read back off the payload rather than through the store's own
 * reader: this step leaves the record where it was for the step after
 * it to move, so at this point in the chain the payload is the only
 * thing that has the answer.
 */

const builder = new ElementAnimationCssBuilder(
  new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
);

const migration = new ProjectV15ToV16Migration(new ElementAnimationCssWriter(builder));

const RISE = { presetId: 'rise-in', params: {} };

/** One element's stored style after the step, as it sits in the payload. */
function migrated(elementStyles: Record<string, unknown>, elementId: string): Record<string, unknown> {
  const data = migration.migrate({ version: 15, elementStyles });
  return (data.elementStyles as Record<string, Record<string, unknown>>)[elementId] ?? {};
}

function cssOf(elementStyles: Record<string, unknown>, elementId: string): string {
  return migrated(elementStyles, elementId).css as string;
}

const SELF_BLOCK = builder.build(RISE, 'word', ElementAnimationScope.SELF);

describe('an entrance that only the record knew about', () => {
  it('is written into the element\'s own CSS', () => {
    expect(cssOf({ w1: { kind: 'word', entrance: RISE, css: '' } }, 'w1')).toContain(SELF_BLOCK);
  });

  it('goes ahead of what the element already carried, which is where it was being emitted', () => {
    const css = cssOf({ w1: { kind: 'word', entrance: RISE, css: 'color: gold;' } }, 'w1');
    expect(css.indexOf(SELF_BLOCK)).toBe(0);
    expect(css).toContain('color: gold;');
  });

  it('is anchored to the clock its element runs on, not the word\'s', () => {
    expect(cssOf({ s1: { kind: 'segment', entrance: RISE, css: '' } }, 's1')).toContain('--on-segment-starts');
  });

  it('stays recorded, so the step after it still has something to file', () => {
    expect(migrated({ w1: { kind: 'word', entrance: RISE, css: '' } }, 'w1').entrance).toEqual(RISE);
  });
});

describe('an element the step has nothing to do for', () => {
  it('keeps its CSS untouched when it never had an entrance', () => {
    expect(cssOf({ w1: { kind: 'word', css: 'color: gold;' } }, 'w1')).toBe('color: gold;');
  });

  it('keeps its CSS untouched when the library no longer offers what it picked', () => {
    const stored = { w1: { kind: 'word', entrance: { presetId: 'gone-in', params: {} }, css: 'color: gold;' } };
    expect(cssOf(stored, 'w1')).toBe('color: gold;');
  });

  it('leaves the payload without the key when no element is styled at all', () => {
    expect(migration.migrate({ version: 15 }).elementStyles).toBeUndefined();
  });
});
