import { describe, expect, it } from 'vitest';
import { CssMinifier } from '@tscaps/engine/advanced';
import { ImportantDeclarationsCssContractRule } from '@core/templates/services/contract/ImportantDeclarationsCssContractRule';

function violationsFor(css: string): string[] {
  const rule = new ImportantDeclarationsCssContractRule();
  return rule.check(new CssMinifier().minify(css)).map((violation) => violation.message);
}

describe('!important in a template stylesheet', () => {
  it('passes a stylesheet without any', () => {
    expect(violationsFor('.word { color: gold; margin: 0 .16em }')).toEqual([]);
  });

  it('is reported once for the whole stylesheet', () => {
    expect(violationsFor('.word { color: gold !important; margin: 0 !important }')).toHaveLength(1);
  });

  it('counts them, so the message says how much is at stake', () => {
    expect(violationsFor('.word { color: gold !important }')[0]).toContain('One declaration is');
    expect(violationsFor('.word { color: gold !important; margin: 0 !important }')[0])
      .toContain('2 declarations are');
  });

  it('catches the spaced spelling a browser also accepts', () => {
    expect(violationsFor('.word { color: gold ! important }')).toHaveLength(1);
  });

  it('ignores one that is commented out', () => {
    expect(violationsFor('.word { /* color: gold !important; */ color: gold }')).toEqual([]);
  });
});
