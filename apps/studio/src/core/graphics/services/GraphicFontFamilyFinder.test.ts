import { describe, expect, it } from 'vitest';
import { FONT_FAMILIES } from '@core/fonts/domain/FontFamilyCatalog';
import { GraphicFontFamilyFinder } from '@core/graphics/services/GraphicFontFamilyFinder';

const finder = new GraphicFontFamilyFinder(FONT_FAMILIES);
const graphic = (parts: { html?: string; css?: string; js?: string }) => ({ html: '', css: '', js: '', ...parts });

describe('GraphicFontFamilyFinder', () => {
  it('finds a family wherever the graphic names it: its CSS, a style attribute, a canvas font', () => {
    const found = finder.find(graphic({
      css: ".big { font-family: 'Anton', sans-serif; }",
      html: '<p style="font-family: Caveat Variable">hi</p>',
      js: "context.font = '700 40px bebas neue';",
    }));

    expect(found).toEqual([
      { family: 'Anton', as: 'Anton' },
      { family: 'Bebas Neue', as: 'Bebas Neue' },
      { family: 'Caveat Variable', as: 'Caveat Variable' },
    ]);
  });

  it('declares a variable family under the name the graphic gives it, with or without "Variable"', () => {
    expect(finder.find(graphic({ css: "p { font-family: 'Inter'; }" }))).toEqual([{ family: 'Inter Variable', as: 'Inter' }]);
    expect(finder.find(graphic({ css: "p { font-family: 'Inter Variable'; }" }))).toEqual([{ family: 'Inter Variable', as: 'Inter Variable' }]);
  });

  it('does not take a longer word or another family\'s name for a family', () => {
    expect(finder.find(graphic({ js: 'const interval = 2; const lorax = 1;', css: "p { font-family: 'DM Serif Display'; }" })))
      .toEqual([{ family: 'DM Serif Display', as: 'DM Serif Display' }]);
  });

  it('finds nothing in a graphic drawn in the system\'s fonts', () => {
    expect(finder.find(graphic({ css: 'p { font-family: system-ui, sans-serif; }' }))).toEqual([]);
  });
});
