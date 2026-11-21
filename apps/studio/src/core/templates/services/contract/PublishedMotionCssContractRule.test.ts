import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssKeyframesScanner, CssMinifier } from '@tscaps/engine/advanced';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';
import { PublishedMotionCssContractRule } from '@core/templates/services/contract/PublishedMotionCssContractRule';

const rule = new PublishedMotionCssContractRule(new CssFragmentParser(new CssMinifier()), new CssKeyframesScanner());
const BUILT: TemplateContractContext = {
  styleControlIds: [],
  filterIds: new Set(),
  declaredAnimationKeyframes: new Set(['tscaps-rise-in', 'tscaps-letter-appear']),
  letterAnimationKeyframes: new Set(['tscaps-letter-appear']),
};
const PLAYS_BOTH = 'animation: var(--word-entrance-animation, none), var(--word-exit-animation, none)';

function violationsFor(css: string, context = BUILT): string[] {
  return rule.check(new CssMinifier().minify(css), context).map((violation) => violation.message);
}

describe('a template\'s motion on a caption element', () => {
  it('passes when it is published through declared.plays', () => {
    expect(violationsFor(`.word { --word-entrance-animation: tscaps-rise-in 1s both; ${PLAYS_BOTH} }`)).toEqual([]);
  });

  it('is reported when a rule writes animation itself', () => {
    const [message] = violationsFor('.word-being-narrated { animation: tscaps-rise-in 1s both }');
    expect(message).toContain('.word-being-narrated');
    expect(message).toContain('declared.plays');
  });

  it('is reported for a longhand, and for none, which an exit would undo as well', () => {
    expect(violationsFor('.segment { animation-name: tscaps-rise-in }')).toHaveLength(1);
    expect(violationsFor('.line:first-child > .word { animation: none }')).toHaveLength(1);
  });

  it('is reported inside a conditional at-rule', () => {
    expect(violationsFor('@container style(--x: 1) { .word { animation: tscaps-rise-in 1s both } }')).toHaveLength(1);
  });

  it('reads nothing in the keyframes themselves', () => {
    expect(violationsFor('@keyframes tscaps-rise-in { from { animation-timing-function: ease } }')).toEqual([]);
  });
});

describe('motion that keeps writing animation', () => {
  it('passes on generated boxes, which an exit on the element reaches without replacing', () => {
    expect(violationsFor('.word::before, .emphasis::after { animation: tscaps-rise-in 1s both }')).toEqual([]);
  });

  it('passes on letters, which have no ends in the editor', () => {
    expect(violationsFor('.letter { animation: tscaps-letter-appear 0.01s step-start both }')).toEqual([]);
  });

  it('is reported where a rule only shares a box with the element', () => {
    expect(violationsFor('.word, .word::after { animation: tscaps-rise-in 1s both }')).toHaveLength(1);
  });
});

describe('a template loaded for editing', () => {
  it('is left alone, since it carries no record to tell letters apart', () => {
    const editing: TemplateContractContext = { styleControlIds: [], filterIds: new Set() };
    expect(violationsFor('.word { animation: tscaps-rise-in 1s both }', editing)).toEqual([]);
  });
});
