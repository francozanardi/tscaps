import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { UnderlineField } from '@core/elements/domain/fields/UnderlineField';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';

/**
 * Where an entrance lands in the text the user edits, and what happens
 * to what was already there.
 *
 * The block is never asserted as a string. What is asserted is that the
 * one the record would build is present or gone, which is the only
 * question anything asks of it.
 */

const controlCssWriter = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));

const builder = new ElementAnimationCssBuilder(
  new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
  new ElementTimingVariableResolver(),
  controlCssWriter,
);

const writer = new ElementAnimationCssWriter(builder);

const RISE: ElementAnimation = { presetId: 'rise-in', params: {} };
const POP: ElementAnimation = { presetId: 'pop-in', params: {} };
const HAND_WRITTEN = 'color: gold;';

function blockOf(entrance: ElementAnimation): string {
  return builder.build(entrance, 'word', ElementAnimationScope.SELF);
}

describe('an entrance arriving on an element that never had one', () => {
  it('lands ahead of what the element already carried, so that keeps winning', () => {
    const css = writer.rewrite(HAND_WRITTEN, 'word', ElementAnimationScope.SELF, undefined, RISE);
    expect(css.indexOf(blockOf(RISE))).toBe(0);
    expect(css).toContain(HAND_WRITTEN);
  });

  it('is the whole of the text on an element that carried nothing', () => {
    expect(writer.rewrite('', 'word', ElementAnimationScope.SELF, undefined, RISE)).toBe(blockOf(RISE));
  });
});

describe('an entrance replacing the one before it', () => {
  it('leaves no trace of the one it replaced', () => {
    const first = writer.rewrite(HAND_WRITTEN, 'word', ElementAnimationScope.SELF, undefined, RISE);
    const second = writer.rewrite(first, 'word', ElementAnimationScope.SELF, RISE, POP);
    expect(second).toContain(blockOf(POP));
    expect(second).not.toContain(blockOf(RISE));
    expect(second).toContain(HAND_WRITTEN);
  });

  it('goes away entirely when the element is put back on the template\'s', () => {
    const written = writer.rewrite(HAND_WRITTEN, 'word', ElementAnimationScope.SELF, undefined, RISE);
    const cleared = writer.rewrite(written, 'word', ElementAnimationScope.SELF, RISE, undefined);
    expect(cleared).toBe(HAND_WRITTEN);
  });
});

/**
 * A caption holds one animation for itself and one for the words
 * inside it, in one text. Each is found by looking for exactly what it
 * produced, so the two have to be able to coexist and to be swapped
 * without touching each other.
 */
describe('the two animations one caption can hold', () => {
  const SELF = ElementAnimationScope.SELF;
  const WORDS = ElementAnimationScope.WORDS;

  function bothWritten(): string {
    const withSelf = writer.rewrite(HAND_WRITTEN, 'segment', SELF, undefined, RISE);
    return writer.rewrite(withSelf, 'segment', WORDS, undefined, RISE);
  }

  it('write blocks that cannot be mistaken for one another', () => {
    expect(builder.build(RISE, 'segment', SELF)).not.toBe(builder.build(RISE, 'segment', WORDS));
  });

  it('both sit in the one text, ahead of what was written by hand', () => {
    const css = bothWritten();
    expect(css).toContain(builder.build(RISE, 'segment', SELF));
    expect(css).toContain(builder.build(RISE, 'segment', WORDS));
    expect(css).toContain(HAND_WRITTEN);
  });

  it('swap one without disturbing the other', () => {
    const swapped = writer.rewrite(bothWritten(), 'segment', WORDS, RISE, POP);
    expect(swapped).toContain(builder.build(RISE, 'segment', SELF));
    expect(swapped).toContain(builder.build(POP, 'segment', WORDS));
    expect(swapped).not.toContain(builder.build(RISE, 'segment', WORDS));
  });

  it('leave the other one deciding when this one is taken over', () => {
    const edited = bothWritten().replace('& :where(.word)', '& :where(.word, .line)');
    expect(writer.isTakenOver(edited, 'segment', WORDS, RISE)).toBe(true);
    expect(writer.isTakenOver(edited, 'segment', SELF, RISE)).toBe(false);
  });

  it('take one away without taking the other', () => {
    const cleared = writer.rewrite(bothWritten(), 'segment', SELF, RISE, undefined);
    expect(cleared).not.toContain(builder.build(RISE, 'segment', SELF));
    expect(cleared).toContain(builder.build(RISE, 'segment', WORDS));
    expect(cleared).toContain(HAND_WRITTEN);
  });
});

/**
 * The block is recognised by looking for exactly the text it produced,
 * so anything else writing into the same text has to write around it.
 * A field landing in the middle of one reported the entrance as edited
 * by hand the moment a user picked an entrance and then set underline.
 */
describe('an entrance beside a field written into the same text', () => {
  const underline = new UnderlineField().controlFor('wrapper');

  it('is still the one the list decides', () => {
    const withEntrance = writer.rewrite('', 'segment', ElementAnimationScope.SELF, undefined, RISE);
    const withField = controlCssWriter.write(withEntrance, underline, 'underline');
    expect(withField).toContain(underline.property);
    expect(writer.isTakenOver(withField, 'segment', ElementAnimationScope.SELF, RISE)).toBe(false);
  });

  it('is still the one the list decides when the field was there first', () => {
    const withField = controlCssWriter.write('', underline, 'underline');
    const withEntrance = writer.rewrite(withField, 'segment', ElementAnimationScope.SELF, undefined, RISE);
    expect(withEntrance).toContain(underline.property);
    expect(writer.isTakenOver(withEntrance, 'segment', ElementAnimationScope.SELF, RISE)).toBe(false);
  });
});

/**
 * An entrance is a set of declarations plus its keyframes, so there is
 * no single line to overwrite. Writing the new one anyway would leave a
 * second animation beside the one somebody wrote.
 */
describe('an entrance the code editor has taken over', () => {
  const edited = writer.rewrite('', 'word', ElementAnimationScope.SELF, undefined, RISE).replace('rise', 'rise-slowly');

  it('says so', () => {
    expect(writer.isTakenOver(edited, 'word', ElementAnimationScope.SELF, RISE)).toBe(true);
    expect(writer.isTakenOver(writer.rewrite('', 'word', ElementAnimationScope.SELF, undefined, RISE), 'word', ElementAnimationScope.SELF, RISE)).toBe(false);
  });

  it('is left exactly as it stands when another is picked', () => {
    expect(writer.rewrite(edited, 'word', ElementAnimationScope.SELF, RISE, POP)).toBe(edited);
  });

  it('covers an entrance the library no longer offers, which writes nothing to look for', () => {
    const gone: ElementAnimation = { presetId: 'gone-in', params: {} };
    expect(writer.isTakenOver(HAND_WRITTEN, 'word', ElementAnimationScope.SELF, gone)).toBe(true);
    expect(writer.rewrite(HAND_WRITTEN, 'word', ElementAnimationScope.SELF, gone, RISE)).toBe(HAND_WRITTEN);
  });
});
